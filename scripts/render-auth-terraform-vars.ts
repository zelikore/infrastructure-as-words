import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  environments,
  platformAdminEmail,
  platformAdminEmailParameterName,
} from "@infrastructure-as-words/infra-config";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const generatedDir = path.resolve(
  rootDir,
  "infra",
  "terraform-auth",
  ".generated",
);
const outputPath = path.resolve(generatedDir, "auth.tfvars.json");
const prodEnvironment = environments.prod;

fs.mkdirSync(generatedDir, { recursive: true });

const payload = {
  aws_region: prodEnvironment.region,
  hosted_zone_id: prodEnvironment.hostedZoneId,
  auth_domain: prodEnvironment.authDomain,
  admin_email: platformAdminEmail,
  admin_email_parameter_name: platformAdminEmailParameterName,
  tags: {
    Project: "infrastructure-as-words",
    ManagedBy: "terraform",
    Stack: "auth",
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
