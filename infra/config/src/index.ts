export type EnvironmentName = "dev" | "prod";

export type EnvironmentConfig = {
  name: EnvironmentName;
  account: string;
  region: string;
  hostedZoneId: string;
  hostedZoneName: string;
  appDomain: string;
  apiDomain: string;
  authDomain: string;
  callbackUrls: string[];
  logoutUrls: string[];
  allowedOrigins: string[];
  webBucketName: string;
  artifactsBucketName: string;
  submissionTableName: string;
  lambdaFunctionName: string;
  bedrockModelIds: string[];
  bedrockInvokeResourceArns: string[];
  adminEmailParameterName: string;
  tags: Record<string, string>;
};

const account = "283107799662";
const region = "us-west-2";
const hostedZoneId = "Z04489831QPP59H15P0H0";
const hostedZoneName = "infrastructure-as-words.com";

const defaultPlatformAdminEmail = "admin@example.com";

export const platformAdminEmail =
  process.env["IAW_ADMIN_EMAIL"]?.trim().toLowerCase() ||
  defaultPlatformAdminEmail;

export const platformAdminEmailParameterName =
  "/infrastructure-as-words/admin-email";

const buildEnvironmentTags = (
  environmentName: EnvironmentName,
): Record<string, string> => ({
  Project: "infrastructure-as-words",
  Environment: environmentName,
  ManagedBy: "terraform",
});

const buildWebBucketName = (environmentName: EnvironmentName): string =>
  `infrastructure-as-words-web-${environmentName}-${account}`;

const buildSubmissionTableName = (environmentName: EnvironmentName): string =>
  `infrastructure-as-words-submissions-${environmentName}`;

const buildArtifactsBucketName = (environmentName: EnvironmentName): string =>
  `infrastructure-as-words-artifacts-${environmentName}-${account}`;

const buildLambdaFunctionName = (environmentName: EnvironmentName): string =>
  `infrastructure-as-words-api-${environmentName}`;

const bedrockModelIds = [
  "us.anthropic.claude-opus-4-7",
  "us.anthropic.claude-opus-4-6-v1",
] as const;

const bedrockFoundationRegions = [
  "us-east-1",
  "us-east-2",
  "us-west-2",
] as const;

const mapFoundationModelId = (modelId: string): string =>
  modelId.replace(/^us\./, "");

const buildBedrockInvokeResourceArns = (): string[] =>
  bedrockModelIds.flatMap((modelId) => [
    `arn:aws:bedrock:${region}:${account}:inference-profile/${modelId}`,
    ...bedrockFoundationRegions.map(
      (foundationRegion) =>
        `arn:aws:bedrock:${foundationRegion}::foundation-model/${mapFoundationModelId(modelId)}`,
    ),
  ]);

const bedrockInvokeResourceArns = buildBedrockInvokeResourceArns();

export const environments: Record<EnvironmentName, EnvironmentConfig> = {
  dev: {
    name: "dev",
    account,
    region,
    hostedZoneId,
    hostedZoneName,
    appDomain: "dev.infrastructure-as-words.com",
    apiDomain: "api.dev.infrastructure-as-words.com",
    authDomain: "auth.infrastructure-as-words.com",
    callbackUrls: [
      "https://dev.infrastructure-as-words.com/auth/callback",
      "http://localhost:3000/auth/callback",
    ],
    logoutUrls: [
      "https://dev.infrastructure-as-words.com",
      "http://localhost:3000",
    ],
    allowedOrigins: [
      "https://dev.infrastructure-as-words.com",
      "http://localhost:3000",
    ],
    webBucketName: buildWebBucketName("dev"),
    artifactsBucketName: buildArtifactsBucketName("dev"),
    submissionTableName: buildSubmissionTableName("dev"),
    lambdaFunctionName: buildLambdaFunctionName("dev"),
    bedrockModelIds: [...bedrockModelIds],
    bedrockInvokeResourceArns,
    adminEmailParameterName: platformAdminEmailParameterName,
    tags: buildEnvironmentTags("dev"),
  },
  prod: {
    name: "prod",
    account,
    region,
    hostedZoneId,
    hostedZoneName,
    appDomain: "infrastructure-as-words.com",
    apiDomain: "api.infrastructure-as-words.com",
    authDomain: "auth.infrastructure-as-words.com",
    callbackUrls: ["https://infrastructure-as-words.com/auth/callback"],
    logoutUrls: ["https://infrastructure-as-words.com"],
    allowedOrigins: ["https://infrastructure-as-words.com"],
    webBucketName: buildWebBucketName("prod"),
    artifactsBucketName: buildArtifactsBucketName("prod"),
    submissionTableName: buildSubmissionTableName("prod"),
    lambdaFunctionName: buildLambdaFunctionName("prod"),
    bedrockModelIds: [...bedrockModelIds],
    bedrockInvokeResourceArns,
    adminEmailParameterName: platformAdminEmailParameterName,
    tags: buildEnvironmentTags("prod"),
  },
};

export const terraformStateBucketName =
  "infrastructure-as-words-terraform-state-283107799662";
export const terraformLockTableName = "infrastructure-as-words-terraform-locks";
export const cognitoResourceServerIdentifier = "infrastructure-as-words";
export const cognitoReadScope = "infrastructure-as-words/read";
export const cognitoWriteScope = "infrastructure-as-words/write";
export const defaultOAuthScopes = [
  "openid",
  "email",
  "profile",
  cognitoReadScope,
  cognitoWriteScope,
] as const;

export const buildAppOrigin = (environmentName: EnvironmentName): string =>
  `https://${environments[environmentName].appDomain}`;

export const buildApiBaseUrl = (environmentName: EnvironmentName): string =>
  `https://${environments[environmentName].apiDomain}`;

export const buildAuthBaseUrl = (environmentName: EnvironmentName): string =>
  `https://${environments[environmentName].authDomain}`;
