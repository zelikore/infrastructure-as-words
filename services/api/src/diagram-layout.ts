import {
  submissionDiagramSchema,
  type DiagramNodeKind,
  type SubmissionDiagram
} from "@infrastructure-as-words/contracts";
import type { DiagramPlanEdge, DiagramPlanNode } from "./generation-schema.js";

const kindLevel: Record<DiagramNodeKind, number> = {
  client: 0,
  dns: 1,
  cdn: 2,
  auth: 2,
  network: 3,
  compute: 4,
  queue: 5,
  storage: 5,
  database: 5,
  integration: 6,
  observability: 6
};

const horizontalGap = 240;
const verticalGap = 160;
const stagePadding = 80;

export const buildSubmissionDiagram = (input: {
  nodes: DiagramPlanNode[];
  edges: DiagramPlanEdge[];
}): SubmissionDiagram => {
  const groupedNodes = new Map<number, DiagramPlanNode[]>();

  input.nodes.forEach((node) => {
    const level = kindLevel[node["kind"]] ?? 0;
    const existing = groupedNodes.get(level) ?? [];
    existing.push(node);
    groupedNodes.set(level, existing);
  });

  const levels = [...groupedNodes.keys()].sort((left, right) => left - right);
  const maxRows = Math.max(...levels.map((level) => groupedNodes.get(level)?.length ?? 0), 1);

  const nodes = levels.flatMap((level) => {
    const levelNodes = groupedNodes.get(level) ?? [];
    const offset = ((maxRows - levelNodes.length) * verticalGap) / 2;

    return levelNodes.map((node, index) => ({
      id: node.id,
      position: {
        x: stagePadding + level * horizontalGap,
        y: stagePadding + offset + index * verticalGap
      },
      data: {
        label: node.label,
        kind: node["kind"],
        ...(node.detail ? { detail: node.detail } : {})
      }
    }));
  });

  const edges = input.edges.map((edge, index) => ({
    id: `edge-${index + 1}-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    ...(edge.label ? { label: edge.label } : {}),
    animated: true
  }));

  const width = stagePadding * 2 + Math.max(levels.length - 1, 0) * horizontalGap;
  const height = stagePadding * 2 + Math.max(maxRows - 1, 0) * verticalGap;

  return submissionDiagramSchema.parse({
    nodes,
    edges,
    viewport: {
      x: 0,
      y: 0,
      zoom: Math.max(0.72, Math.min(1.1, 860 / Math.max(width, height)))
    }
  });
};
