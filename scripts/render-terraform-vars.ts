import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  environments,
  terraformStateBucketName,
  type EnvironmentName,
} from "@infrastructure-as-words/infra-config";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sharedAuthStateKey = "auth/terraform.tfstate";

const readEnvironmentName = (): EnvironmentName => {
  const envIndex = process.argv.indexOf("--env");
  const value =
    envIndex >= 0 ? process.argv[envIndex + 1] : process.env["DEPLOY_ENV"];
  if (value === "dev" || value === "prod") {
    return value;
  }

  throw new Error(
    'Use "--env dev" or "--env prod" when rendering Terraform variables.',
  );
};

const environmentName = readEnvironmentName();
const environment = environments[environmentName];
const generatedDir = path.resolve(rootDir, "infra", "terraform", ".generated");
const outputPath = path.resolve(generatedDir, `${environmentName}.tfvars.json`);

fs.mkdirSync(generatedDir, { recursive: true });

const payload = {
  environment_name: environment.name,
  account_id: environment.account,
  aws_region: environment.region,
  hosted_zone_id: environment.hostedZoneId,
  hosted_zone_name: environment.hostedZoneName,
  app_domain: environment.appDomain,
  api_domain: environment.apiDomain,
  auth_domain: environment.authDomain,
  callback_urls: environment.callbackUrls,
  logout_urls: environment.logoutUrls,
  allowed_origins: environment.allowedOrigins,
  terraform_state_bucket_name: terraformStateBucketName,
  shared_auth_state_key: sharedAuthStateKey,
  web_bucket_name: environment.webBucketName,
  artifacts_bucket_name: environment.artifactsBucketName,
  submission_table_name: environment.submissionTableName,
  lambda_function_name: environment.lambdaFunctionName,
  bedrock_model_ids: environment.bedrockModelIds,
  bedrock_invoke_resource_arns: environment.bedrockInvokeResourceArns,
  admin_email_parameter_name: environment.adminEmailParameterName,
  api_bundle_path: path.resolve(
    rootDir,
    "services",
    "api",
    "dist",
    "lambda",
    "index.js",
  ),
  tags: environment.tags,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
