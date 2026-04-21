import { z } from "zod";

const environmentSchema = z.object({
  AWS_REGION: z.string().min(1).default("us-west-2"),
  DEPLOY_ENV: z.enum(["dev", "prod"]),
  SUBMISSIONS_TABLE_NAME: z.string().min(1),
  ARTIFACTS_BUCKET_NAME: z.string().min(1),
  AUTH_DOMAIN: z.string().min(1),
  BEDROCK_MODEL_IDS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((modelId) => modelId.trim())
        .filter((modelId) => modelId.length > 0),
    )
    .pipe(z.array(z.string().min(1)).min(1)),
  CURRENT_FUNCTION_NAME: z.string().min(1),
  ADMIN_EMAIL_ALLOWLIST: z.string().default(""),
  ADMIN_EMAIL_PARAMETER_NAME: z.string().default(""),
  OBSERVABILITY_DASHBOARD_NAME: z.string().default(""),
  OBSERVABILITY_ALARM_NAMES: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  OBSERVABILITY_ALERTS_TOPIC_ARN: z.string().default(""),
  OBSERVABILITY_API_ID: z.string().default(""),
  OBSERVABILITY_API_STAGE_NAME: z.string().default("$default"),
  OBSERVABILITY_LAMBDA_LOG_GROUP_NAME: z.string().default(""),
  OBSERVABILITY_API_LOG_GROUP_NAME: z.string().default(""),
  ARTIFACT_DOWNLOAD_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
});

export type ApiEnvironment = z.infer<typeof environmentSchema>;

let cachedEnvironment: ApiEnvironment | undefined;

export const getEnvironment = (): ApiEnvironment => {
  if (!cachedEnvironment) {
    cachedEnvironment = environmentSchema.parse(process.env);
  }
  return cachedEnvironment;
};
