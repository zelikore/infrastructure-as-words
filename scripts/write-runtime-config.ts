import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildApiBaseUrl,
  buildAppOrigin,
  defaultOAuthScopes,
  environments,
  type EnvironmentName
} from "@infrastructure-as-words/infra-config";
import { webRuntimeConfigSchema } from "@infrastructure-as-words/contracts";

type TerraformOutputs = {
  user_pool_client_id: { value: string };
  user_pool_id: { value: string };
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readArgument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const environmentName = readArgument("--env");
if (environmentName !== "dev" && environmentName !== "prod") {
  throw new Error('Use "--env dev" or "--env prod" when writing runtime config.');
}

const outputsPath = readArgument("--outputs");
if (!outputsPath) {
  throw new Error('Use "--outputs <path>" to point at the Terraform output JSON file.');
}

const environment = environments[environmentName as EnvironmentName];
const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf8")) as TerraformOutputs;

const runtimeConfig = webRuntimeConfigSchema.parse({
  environmentName,
  appOrigin: buildAppOrigin(environment.name),
  apiBaseUrl: buildApiBaseUrl(environment.name),
  authDomain: environment.authDomain,
  authIssuer: `https://cognito-idp.${environment.region}.amazonaws.com/${outputs.user_pool_id.value}`,
  userPoolClientId: outputs.user_pool_client_id.value,
  oauthScopes: [...defaultOAuthScopes],
  redirectUri: environment.callbackUrls[0],
  logoutUri: environment.logoutUrls[0]
});

const destination = path.resolve(rootDir, "web", "out", environmentName, "runtime-config.json");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(runtimeConfig, null, 2)}\n`);

