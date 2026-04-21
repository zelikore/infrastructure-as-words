import { randomUUID } from "node:crypto";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";
import {
  generationSettingsSchema,
  submissionDetailSchema,
  submissionSummarySchema,
  type GeneratedArchitecture,
  type GenerationSettings,
  type GenerationSettingsInput,
  type SubmissionAiUsage,
  type SubmissionArtifact,
  type SubmissionDetail,
  type SubmissionInput,
  type SubmissionSummary
} from "@infrastructure-as-words/contracts";
import { buildDefaultGenerationSettings } from "./default-generation-settings.js";
import { getEnvironment } from "./environment.js";

type SubmissionSummaryRecord = {
  pk: string;
  sk: string;
  entityType: "submission-summary";
  submission: SubmissionSummary;
};

type SubmissionDetailRecord = {
  pk: string;
  sk: "DETAIL";
  entityType: "submission-detail";
  submission: SubmissionDetail;
};

type GenerationSettingsRecord = {
  pk: "ORG#CONFIG";
  sk: "GENERATION#SETTINGS";
  entityType: "generation-settings";
  settings: GenerationSettings;
};

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const buildUserPartitionKey = (userSub: string): string => `USER#${userSub}`;
const buildSubmissionPartitionKey = (submissionId: string): string => `SUBMISSION#${submissionId}`;
const buildSubmissionSortKey = (createdAt: string, submissionId: string): string =>
  `SUBMISSION#${createdAt}#${submissionId}`;

const buildSummaryRecord = (submission: SubmissionSummary): SubmissionSummaryRecord => ({
  pk: buildUserPartitionKey(submission.userSub),
  sk: buildSubmissionSortKey(submission.createdAt, submission.submissionId),
  entityType: "submission-summary",
  submission
});

const buildDetailRecord = (submission: SubmissionDetail): SubmissionDetailRecord => ({
  pk: buildSubmissionPartitionKey(submission.submissionId),
  sk: "DETAIL",
  entityType: "submission-detail",
  submission
});

const toSummary = (submission: SubmissionDetail): SubmissionSummary =>
  submissionSummarySchema.parse(submission);

const putSubmissionRecords = async (submission: SubmissionDetail): Promise<void> => {
  const environment = getEnvironment();
  const summary = toSummary(submission);

  await Promise.all([
    documentClient.send(
      new PutCommand({
        TableName: environment.SUBMISSIONS_TABLE_NAME,
        Item: buildSummaryRecord(summary)
      })
    ),
    documentClient.send(
      new PutCommand({
        TableName: environment.SUBMISSIONS_TABLE_NAME,
        Item: buildDetailRecord(submission)
      })
    )
  ]);
};

const readDetailRecord = async (submissionId: string): Promise<SubmissionDetail | undefined> => {
  const environment = getEnvironment();
  const response = await documentClient.send(
    new GetCommand({
      TableName: environment.SUBMISSIONS_TABLE_NAME,
      Key: {
        pk: buildSubmissionPartitionKey(submissionId),
        sk: "DETAIL"
      }
    })
  );

  const record = response.Item as SubmissionDetailRecord | undefined;
  return record ? submissionDetailSchema.parse(record.submission) : undefined;
};

export const createSubmission = async (input: {
  userSub: string;
  userEmail?: string;
  payload: SubmissionInput;
}): Promise<SubmissionSummary> => {
  const createdAt = new Date().toISOString();
  const submissionId = randomUUID();

  const submission = submissionDetailSchema.parse({
    submissionId,
    userSub: input.userSub,
    ...(input.userEmail ? { userEmail: input.userEmail } : {}),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    description: input.payload.description,
    artifactAvailable: false
  });

  await putSubmissionRecords(submission);
  return toSummary(submission);
};

export const listSubmissions = async (userSub: string): Promise<SubmissionSummary[]> => {
  const environment = getEnvironment();
  const response = await documentClient.send(
    new QueryCommand({
      TableName: environment.SUBMISSIONS_TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": buildUserPartitionKey(userSub),
        ":prefix": "SUBMISSION#"
      },
      ScanIndexForward: false,
      Limit: 100
    })
  );

  const items = (response.Items ?? []) as SubmissionSummaryRecord[];
  return items.map((item) => submissionSummarySchema.parse(item.submission));
};

export const getSubmissionForUser = async (input: {
  submissionId: string;
  userSub: string;
}): Promise<SubmissionDetail | undefined> => {
  const submission = await readDetailRecord(input.submissionId);
  if (!submission || submission.userSub !== input.userSub) {
    return undefined;
  }

  return submission;
};

export const getSubmissionForGeneration = async (
  submissionId: string
): Promise<SubmissionDetail | undefined> => readDetailRecord(submissionId);

export const completeSubmissionGeneration = async (input: {
  submissionId: string;
  architecture: GeneratedArchitecture;
  artifact: SubmissionArtifact;
  aiUsage: SubmissionAiUsage;
}): Promise<SubmissionDetail> => {
  const current = await readDetailRecord(input.submissionId);
  if (!current) {
    throw new Error(`Submission ${input.submissionId} was not found.`);
  }

  const nextSubmission = submissionDetailSchema.parse({
    ...current,
    updatedAt: new Date().toISOString(),
    status: "completed",
    summary: input.architecture.summary,
    artifactAvailable: true,
    aiCostUsd: input.aiUsage.actualCostUsd,
    artifact: input.artifact,
    architecture: input.architecture,
    aiUsage: input.aiUsage,
    failureMessage: undefined,
    budgetReservationUsd: undefined,
    budgetReservationPeriodKey: undefined
  });

  await putSubmissionRecords(nextSubmission);
  return nextSubmission;
};

export const failSubmissionGeneration = async (input: {
  submissionId: string;
  failureMessage: string;
  aiUsage?: SubmissionAiUsage;
}): Promise<SubmissionDetail> => {
  const current = await readDetailRecord(input.submissionId);
  if (!current) {
    throw new Error(`Submission ${input.submissionId} was not found.`);
  }

  const nextSubmission = submissionDetailSchema.parse({
    ...current,
    updatedAt: new Date().toISOString(),
    status: "failed",
    artifactAvailable: false,
    aiCostUsd: input.aiUsage?.actualCostUsd,
    summary: current.summary,
    artifact: undefined,
    architecture: undefined,
    aiUsage: input.aiUsage,
    failureMessage: input.failureMessage,
    budgetReservationUsd: undefined,
    budgetReservationPeriodKey: undefined
  });

  await putSubmissionRecords(nextSubmission);
  return nextSubmission;
};

export const setSubmissionBudgetReservation = async (input: {
  submissionId: string;
  reservationUsd: number;
  periodKey: string;
}): Promise<SubmissionDetail> => {
  const current = await readDetailRecord(input.submissionId);
  if (!current) {
    throw new Error(`Submission ${input.submissionId} was not found.`);
  }

  const nextSubmission = submissionDetailSchema.parse({
    ...current,
    updatedAt: new Date().toISOString(),
    budgetReservationUsd: input.reservationUsd,
    budgetReservationPeriodKey: input.periodKey
  });

  await putSubmissionRecords(nextSubmission);
  return nextSubmission;
};

export const getGenerationSettings = async (): Promise<GenerationSettings> => {
  const environment = getEnvironment();
  const response = await documentClient.send(
    new GetCommand({
      TableName: environment.SUBMISSIONS_TABLE_NAME,
      Key: {
        pk: "ORG#CONFIG",
        sk: "GENERATION#SETTINGS"
      }
    })
  );

  const record = response.Item as GenerationSettingsRecord | undefined;
  return record
    ? generationSettingsSchema.parse(record.settings)
    : generationSettingsSchema.parse(buildDefaultGenerationSettings());
};

export const saveGenerationSettings = async (input: {
  settings: GenerationSettingsInput;
  updatedBy?: string;
}): Promise<GenerationSettings> => {
  const environment = getEnvironment();
  const settings = generationSettingsSchema.parse({
    ...input.settings,
    updatedAt: new Date().toISOString(),
    ...(input.updatedBy ? { updatedBy: input.updatedBy } : {})
  });

  const record: GenerationSettingsRecord = {
    pk: "ORG#CONFIG",
    sk: "GENERATION#SETTINGS",
    entityType: "generation-settings",
    settings
  };

  await documentClient.send(
    new PutCommand({
      TableName: environment.SUBMISSIONS_TABLE_NAME,
      Item: record
    })
  );

  return settings;
};
