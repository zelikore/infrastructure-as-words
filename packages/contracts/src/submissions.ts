import { z } from "zod";

export const SUBMISSION_DESCRIPTION_MAX_LENGTH = 10_000;
export const submissionReadScope = "infrastructure-as-words/read";
export const submissionWriteScope = "infrastructure-as-words/write";
export const cognitoOAuthScopes = [
  "openid",
  "email",
  "profile",
  submissionReadScope,
  submissionWriteScope,
] as const;

const timestampSchema = z.iso.datetime();
const shortText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);
const usdAmountSchema = z.number().finite().min(0).max(100_000);

export const moduleVisibilitySchema = z.enum(["private", "public"]);
export const modulePrioritySchema = z.enum([
  "preferred",
  "allowed",
  "fallback",
]);
export const submissionStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
]);
export const moduleCategorySchema = z.enum([
  "platform",
  "identity",
  "edge",
  "network",
  "compute",
  "data",
  "observability",
  "security",
  "delivery",
]);
export const moduleDocumentationSchema = z.object({
  summary: shortText(240).default("General-purpose Terraform module."),
  howItWorks: shortText(1_200).default(
    "Provides reusable infrastructure composition aligned to platform standards.",
  ),
  usageNotes: shortText(600).optional(),
});

export const submissionInputSchema = z.object({
  description: shortText(SUBMISSION_DESCRIPTION_MAX_LENGTH),
});

export const moduleCatalogEntrySchema = z.object({
  moduleId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  label: shortText(80),
  source: shortText(240),
  visibility: moduleVisibilitySchema,
  priority: modulePrioritySchema,
  description: shortText(240),
  category: moduleCategorySchema.default("platform"),
  required: z.boolean().default(false),
  capabilities: z.array(shortText(48)).min(1).max(12).default(["general"]),
  documentation: moduleDocumentationSchema.default({
    summary: "General-purpose Terraform module.",
    howItWorks:
      "Provides reusable infrastructure composition aligned to platform standards.",
  }),
});

export const budgetPolicySchema = z.object({
  monthlyLimitUsd: usdAmountSchema.min(1).max(10_000).default(20),
});

export const generationSettingsSchema = z.object({
  organizationName: shortText(80),
  guidance: shortText(3_000),
  guardrails: z.array(shortText(240)).min(1).max(12),
  limitationsTemplate: z.array(shortText(240)).max(12),
  preferredRegions: z.array(shortText(32)).min(1).max(5),
  modules: z.array(moduleCatalogEntrySchema).min(1).max(30),
  budgetPolicy: budgetPolicySchema.default({
    monthlyLimitUsd: 20,
  }),
  updatedAt: timestampSchema,
  updatedBy: shortText(120).optional(),
});

export const generationSettingsInputSchema = generationSettingsSchema.omit({
  updatedAt: true,
  updatedBy: true,
});

export const submissionArtifactSchema = z.object({
  fileName: shortText(120),
  sizeBytes: z.int().nonnegative(),
  createdAt: timestampSchema,
  downloadUrl: z.url().optional(),
  downloadUrlExpiresAt: timestampSchema.optional(),
});

export const submissionAiUsageSchema = z.object({
  modelIds: z.array(shortText(120)).min(1).max(4),
  attempts: z.int().positive().max(4),
  inputTokens: z.int().nonnegative(),
  outputTokens: z.int().nonnegative(),
  cacheReadInputTokens: z.int().nonnegative(),
  totalTokens: z.int().nonnegative(),
  actualCostUsd: usdAmountSchema,
  reservedCostUsd: usdAmountSchema,
  pricedAt: timestampSchema,
});

export const generatedFileManifestSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[A-Za-z0-9._/-]+$/),
  language: z.enum(["hcl", "md", "json", "yaml", "text"]),
  sizeBytes: z.int().nonnegative(),
});

export const selectedModuleSchema = z.object({
  moduleId: shortText(64),
  label: shortText(80),
  source: shortText(240),
  visibility: moduleVisibilitySchema,
  reason: shortText(320),
});

export const architectureExplanationSchema = z.object({
  title: shortText(80),
  detail: shortText(400),
});

export const diagramNodeKindSchema = z.enum([
  "client",
  "dns",
  "cdn",
  "auth",
  "network",
  "compute",
  "storage",
  "database",
  "queue",
  "integration",
  "observability",
]);

export const diagramNodeSchema = z.object({
  id: shortText(64),
  type: z.string().trim().min(1).max(40).optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    label: shortText(80),
    kind: diagramNodeKindSchema,
    detail: shortText(240).optional(),
  }),
});

export const diagramEdgeSchema = z.object({
  id: shortText(64),
  source: shortText(64),
  target: shortText(64),
  label: shortText(120).optional(),
  animated: z.boolean().optional(),
});

export const diagramViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});

export const submissionDiagramSchema = z.object({
  nodes: z.array(diagramNodeSchema).min(1).max(20),
  edges: z.array(diagramEdgeSchema).max(30),
  viewport: diagramViewportSchema,
});

export const generatedArchitectureSchema = z.object({
  name: shortText(120),
  summary: shortText(320),
  explanation: z.array(architectureExplanationSchema).min(1).max(8),
  limitations: z.array(shortText(320)).min(1).max(8),
  modules: z.array(selectedModuleSchema).max(12),
  files: z.array(generatedFileManifestSchema).min(1).max(16),
  diagram: submissionDiagramSchema,
});

export const submissionSummarySchema = z.object({
  submissionId: shortText(64),
  userSub: shortText(120),
  userEmail: z.email().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  status: submissionStatusSchema,
  description: submissionInputSchema.shape.description,
  summary: shortText(320).optional(),
  artifactAvailable: z.boolean(),
  aiCostUsd: usdAmountSchema.optional(),
});

export const submissionDetailSchema = submissionSummarySchema.extend({
  failureMessage: shortText(320).optional(),
  artifact: submissionArtifactSchema.optional(),
  architecture: generatedArchitectureSchema.optional(),
  aiUsage: submissionAiUsageSchema.optional(),
  budgetReservationUsd: usdAmountSchema.optional(),
  budgetReservationPeriodKey: shortText(16).optional(),
});

export const budgetStatusSchema = z.object({
  periodKey: shortText(16),
  periodStart: timestampSchema,
  periodEnd: timestampSchema,
  monthlyLimitUsd: usdAmountSchema,
  spentUsd: usdAmountSchema,
  reservedUsd: usdAmountSchema,
  remainingUsd: usdAmountSchema,
  requestCount: z.int().nonnegative(),
});

export const workspaceProfileSchema = z.object({
  organizationName: shortText(80),
  governedModuleCount: z.int().nonnegative(),
  canManageGovernance: z.boolean(),
});

export const observabilityConsoleLinksSchema = z.object({
  dashboardUrl: z.url(),
  alarmsUrl: z.url(),
  lambdaLogsUrl: z.url(),
  apiLogsUrl: z.url(),
  notificationsUrl: z.url(),
});

export const submissionsResponseSchema = z.object({
  submissions: z.array(submissionSummarySchema),
});

export const submissionDetailResponseSchema = z.object({
  submission: submissionDetailSchema,
});

export const generationSettingsResponseSchema = z.object({
  settings: generationSettingsSchema,
  budget: budgetStatusSchema,
  observability: observabilityConsoleLinksSchema,
});

export const workspaceProfileResponseSchema = z.object({
  profile: workspaceProfileSchema,
});

export const submissionSchema = submissionSummarySchema;

export type ModuleVisibility = z.infer<typeof moduleVisibilitySchema>;
export type ModulePriority = z.infer<typeof modulePrioritySchema>;
export type ModuleCategory = z.infer<typeof moduleCategorySchema>;
export type ModuleDocumentation = z.infer<typeof moduleDocumentationSchema>;
export type ModuleCatalogEntry = z.infer<typeof moduleCatalogEntrySchema>;
export type BudgetPolicy = z.infer<typeof budgetPolicySchema>;
export type GenerationSettings = z.infer<typeof generationSettingsSchema>;
export type GenerationSettingsInput = z.infer<
  typeof generationSettingsInputSchema
>;
export type SubmissionInput = z.infer<typeof submissionInputSchema>;
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;
export type SubmissionArtifact = z.infer<typeof submissionArtifactSchema>;
export type SubmissionAiUsage = z.infer<typeof submissionAiUsageSchema>;
export type GeneratedFileManifest = z.infer<typeof generatedFileManifestSchema>;
export type SelectedModule = z.infer<typeof selectedModuleSchema>;
export type DiagramNodeKind = z.infer<typeof diagramNodeKindSchema>;
export type SubmissionDiagram = z.infer<typeof submissionDiagramSchema>;
export type GeneratedArchitecture = z.infer<typeof generatedArchitectureSchema>;
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;
export type SubmissionDetail = z.infer<typeof submissionDetailSchema>;
export type BudgetStatus = z.infer<typeof budgetStatusSchema>;
export type WorkspaceProfile = z.infer<typeof workspaceProfileSchema>;
export type ObservabilityConsoleLinks = z.infer<
  typeof observabilityConsoleLinksSchema
>;
export type SubmissionsResponse = z.infer<typeof submissionsResponseSchema>;
export type SubmissionDetailResponse = z.infer<
  typeof submissionDetailResponseSchema
>;
export type GenerationSettingsResponse = z.infer<
  typeof generationSettingsResponseSchema
>;
export type WorkspaceProfileResponse = z.infer<
  typeof workspaceProfileResponseSchema
>;
export type Submission = SubmissionSummary;
