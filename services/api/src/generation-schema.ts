import { z } from "zod";
import {
  diagramNodeKindSchema,
  moduleVisibilitySchema
} from "@infrastructure-as-words/contracts";

const shortText = (maxLength: number) => z.string().trim().min(1).max(maxLength);

export const generatedFileSchema = z.object({
  path: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._/-]+$/),
  language: z.enum(["hcl", "md", "json", "yaml", "text"]),
  content: z.string().trim().min(1).max(60_000)
});

export const diagramPlanNodeSchema = z.object({
  id: shortText(64),
  label: shortText(80),
  kind: diagramNodeKindSchema,
  detail: shortText(240).optional()
});

export const diagramPlanEdgeSchema = z.object({
  source: shortText(64),
  target: shortText(64),
  label: shortText(120).optional()
});

export const generationDraftSchema = z.object({
  name: shortText(120),
  summary: shortText(320),
  explanation: z
    .array(
      z.object({
        title: shortText(80),
        detail: shortText(400)
      })
    )
    .min(1)
    .max(8),
  limitations: z.array(shortText(320)).min(1).max(8),
  modules: z
    .array(
      z.object({
        moduleId: shortText(64),
        label: shortText(80),
        source: shortText(240),
        visibility: moduleVisibilitySchema,
        reason: shortText(320)
      })
    )
    .max(12),
  files: z.array(generatedFileSchema).min(1).max(16),
  diagram: z.object({
    nodes: z.array(diagramPlanNodeSchema).min(1).max(20),
    edges: z.array(diagramPlanEdgeSchema).max(30)
  })
});

export type GeneratedFile = z.infer<typeof generatedFileSchema>;
export type DiagramPlanNode = z.infer<typeof diagramPlanNodeSchema>;
export type DiagramPlanEdge = z.infer<typeof diagramPlanEdgeSchema>;
export type GenerationDraft = z.infer<typeof generationDraftSchema>;
