import type { GenerationSettings } from "@infrastructure-as-words/contracts";
import { platformModuleCatalog } from "./module-catalog.js";

const cloneCatalog = () =>
  platformModuleCatalog.map((module) => ({
    ...module,
    capabilities: [...module.capabilities],
    documentation: {
      ...module.documentation
    }
  }));

export const buildDefaultGenerationSettings = (): GenerationSettings => ({
  organizationName: "Infrastructure as Words",
  guidance:
    "Design AWS infrastructure that is production-ready, cost-conscious, and straightforward to operate. Prefer managed services, serverless delivery, clear IAM boundaries, encrypted data stores, and explicit observability. Reuse prioritized Terraform modules when they fit the request cleanly. When a request is underspecified, choose safe defaults and explain the tradeoffs.",
  guardrails: [
    "Use Terraform only and keep the generated structure apply-ready.",
    "Prefer managed AWS services over self-managed compute when either can satisfy the requirement.",
    "Encrypt data at rest and use least-privilege IAM boundaries.",
    "Explain assumptions, tradeoffs, and any manual follow-up clearly."
  ],
  limitationsTemplate: [
    "Generated infrastructure still needs human review before apply.",
    "Private module sources must be reachable by the destination organization."
  ],
  preferredRegions: ["us-west-2"],
  budgetPolicy: {
    monthlyLimitUsd: 20
  },
  modules: cloneCatalog(),
  updatedAt: new Date(0).toISOString()
});
