import {
  ConditionalCheckFailedException,
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";
import {
  budgetStatusSchema,
  type BudgetStatus
} from "@infrastructure-as-words/contracts";
import { getEnvironment } from "./environment.js";
import { roundUsd } from "./bedrock-pricing.js";

type BudgetRecord = BudgetStatus & {
  pk: "ORG#BUDGET";
  sk: string;
  entityType: "generation-budget";
  updatedAt: string;
};

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const BUDGET_PARTITION_KEY = "ORG#BUDGET";

export class BudgetLimitError extends Error {}

const buildBudgetPeriod = (date: Date): {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
} => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  return {
    periodKey: `${year}-${String(month + 1).padStart(2, "0")}`,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString()
  };
};

const buildBudgetSortKey = (periodKey: string): string => `PERIOD#${periodKey}`;

const resolveBudgetPeriod = (periodKey?: string): {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
} => {
  if (periodKey) {
    const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
    if (!match) {
      throw new Error(`Budget period key ${periodKey} is invalid.`);
    }

    const yearText = match[1] ?? "";
    const monthText = match[2] ?? "";
    const year = Number.parseInt(yearText, 10);
    const month = Number.parseInt(monthText, 10);
    return buildBudgetPeriod(new Date(Date.UTC(year, month - 1, 1)));
  }

  return buildBudgetPeriod(new Date());
};

const toBudgetStatus = (input: {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  monthlyLimitUsd: number;
  spentUsd?: number;
  reservedUsd?: number;
  requestCount?: number;
}): BudgetStatus =>
  budgetStatusSchema.parse({
    periodKey: input.periodKey,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    monthlyLimitUsd: roundUsd(input.monthlyLimitUsd),
    spentUsd: roundUsd(input.spentUsd ?? 0),
    reservedUsd: roundUsd(input.reservedUsd ?? 0),
    remainingUsd: roundUsd(
      Math.max(0, input.monthlyLimitUsd - (input.spentUsd ?? 0) - (input.reservedUsd ?? 0))
    ),
    requestCount: input.requestCount ?? 0
  });

const readBudgetRecord = async (periodKey: string): Promise<BudgetRecord | undefined> => {
  const environment = getEnvironment();
  const response = await documentClient.send(
    new GetCommand({
      TableName: environment.SUBMISSIONS_TABLE_NAME,
      Key: {
        pk: BUDGET_PARTITION_KEY,
        sk: buildBudgetSortKey(periodKey)
      }
    })
  );

  const record = response.Item as BudgetRecord | undefined;
  return record
    ? {
        ...record,
        ...budgetStatusSchema.parse(record)
      }
    : undefined;
};

const writeBudgetRecord = async (input: {
  previous: BudgetRecord | undefined;
  next: BudgetStatus;
}): Promise<void> => {
  const environment = getEnvironment();
  const updatedAt = new Date().toISOString();
  const record: BudgetRecord = {
    pk: BUDGET_PARTITION_KEY,
    sk: buildBudgetSortKey(input.next.periodKey),
    entityType: "generation-budget",
    updatedAt,
    ...input.next
  };

  await documentClient.send(
    new PutCommand({
      TableName: environment.SUBMISSIONS_TABLE_NAME,
      Item: record,
      ...(input.previous
        ? {
            ConditionExpression:
              "updatedAt = :updatedAt AND spentUsd = :spentUsd AND reservedUsd = :reservedUsd AND requestCount = :requestCount",
            ExpressionAttributeValues: {
              ":updatedAt": input.previous.updatedAt,
              ":spentUsd": input.previous.spentUsd,
              ":reservedUsd": input.previous.reservedUsd,
              ":requestCount": input.previous.requestCount
            }
          }
        : {
            ConditionExpression: "attribute_not_exists(pk)"
          })
    })
  );
};

const mutateBudgetRecord = async (input: {
  monthlyLimitUsd: number;
  periodKey?: string;
  mutate: (current: BudgetStatus) => BudgetStatus;
}): Promise<BudgetStatus> => {
  const period = resolveBudgetPeriod(input.periodKey);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const currentRecord = await readBudgetRecord(period.periodKey);
    const current = currentRecord
      ? budgetStatusSchema.parse(currentRecord)
      : toBudgetStatus({
          ...period,
          monthlyLimitUsd: input.monthlyLimitUsd
        });
    const next = input.mutate(
      toBudgetStatus({
        ...current,
        monthlyLimitUsd: input.monthlyLimitUsd
      })
    );

    try {
      await writeBudgetRecord({
        previous: currentRecord,
        next
      });
      return next;
    } catch (error) {
      if (
        error instanceof ConditionalCheckFailedException ||
        (typeof error === "object" &&
          error !== null &&
          "name" in error &&
          error.name === "ConditionalCheckFailedException")
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to update the generation budget after multiple retries.");
};

export const getGenerationBudgetStatus = async (
  monthlyLimitUsd: number,
  periodKey?: string
): Promise<BudgetStatus> => {
  const period = resolveBudgetPeriod(periodKey);
  const record = await readBudgetRecord(period.periodKey);

  return record
    ? toBudgetStatus({
        ...record,
        monthlyLimitUsd
      })
    : toBudgetStatus({
        ...period,
        monthlyLimitUsd
      });
};

export const reserveGenerationBudget = async (input: {
  monthlyLimitUsd: number;
  reservationUsd: number;
  periodKey?: string;
}): Promise<BudgetStatus> =>
  mutateBudgetRecord({
    monthlyLimitUsd: input.monthlyLimitUsd,
    ...(input.periodKey ? { periodKey: input.periodKey } : {}),
    mutate: (current) => {
      if (current.remainingUsd < input.reservationUsd) {
        throw new BudgetLimitError(
          `The monthly AI budget is exhausted. Remaining $${current.remainingUsd.toFixed(2)}, request needs up to $${input.reservationUsd.toFixed(2)}.`
        );
      }

      return toBudgetStatus({
        ...current,
        reservedUsd: current.reservedUsd + input.reservationUsd
      });
    }
  });

export const releaseGenerationBudgetReservation = async (input: {
  monthlyLimitUsd: number;
  reservationUsd: number;
  periodKey?: string;
}): Promise<BudgetStatus> =>
  mutateBudgetRecord({
    monthlyLimitUsd: input.monthlyLimitUsd,
    ...(input.periodKey ? { periodKey: input.periodKey } : {}),
    mutate: (current) =>
      toBudgetStatus({
        ...current,
        reservedUsd: Math.max(0, current.reservedUsd - input.reservationUsd)
      })
  });

export const settleGenerationBudgetReservation = async (input: {
  monthlyLimitUsd: number;
  reservationUsd: number;
  actualCostUsd: number;
  periodKey?: string;
}): Promise<BudgetStatus> =>
  mutateBudgetRecord({
    monthlyLimitUsd: input.monthlyLimitUsd,
    ...(input.periodKey ? { periodKey: input.periodKey } : {}),
    mutate: (current) =>
      toBudgetStatus({
        ...current,
        spentUsd: current.spentUsd + input.actualCostUsd,
        reservedUsd: Math.max(0, current.reservedUsd - input.reservationUsd),
        requestCount: current.requestCount + 1
      })
  });
