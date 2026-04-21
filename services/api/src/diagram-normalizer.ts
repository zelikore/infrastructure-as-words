import type { DiagramNodeKind } from "@infrastructure-as-words/contracts";
import type { DiagramPlanEdge, DiagramPlanNode, GenerationDraft } from "./generation-schema.js";
import {
  asRecord,
  readTextFromKeys,
  titleize,
  toSlug,
  trimToLength
} from "./generation-normalizer-shared.js";

const diagramKinds = [
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
  "observability"
] as const satisfies readonly DiagramNodeKind[];

const inferDiagramKind = (value: string): DiagramNodeKind => {
  const normalized = value.toLowerCase();
  if (/(cognito|auth|identity|login)/.test(normalized)) {
    return "auth";
  }
  if (/(browser|client|frontend|web app|spa)/.test(normalized)) {
    return "client";
  }
  if (/(route53|dns|domain)/.test(normalized)) {
    return "dns";
  }
  if (/(cloudfront|cdn)/.test(normalized)) {
    return "cdn";
  }
  if (/(vpc|subnet|nat|gateway|network|security group)/.test(normalized)) {
    return "network";
  }
  if (/(lambda|ecs|ec2|fargate|container|compute|function|service)/.test(normalized)) {
    return "compute";
  }
  if (/(s3|bucket|artifact|storage|object)/.test(normalized)) {
    return "storage";
  }
  if (/(dynamodb|database|aurora|postgres|mysql|table|rds)/.test(normalized)) {
    return "database";
  }
  if (/(queue|sns|sqs|eventbridge|stream|bus)/.test(normalized)) {
    return "queue";
  }
  if (/(api gateway|api|integration|load balancer|appsync)/.test(normalized)) {
    return "integration";
  }
  if (/(cloudwatch|alarm|metric|monitor|log|observability|trace)/.test(normalized)) {
    return "observability";
  }
  return "compute";
};

const normalizeNodeKind = (value: string | undefined, fallbackText: string): DiagramNodeKind => {
  if (value && diagramKinds.includes(value as DiagramNodeKind)) {
    return value as DiagramNodeKind;
  }

  return inferDiagramKind(fallbackText);
};

const buildFallbackNodes = (
  modules: GenerationDraft["modules"],
  files: GenerationDraft["files"]
): DiagramPlanNode[] => {
  if (modules.length > 0) {
    return modules.slice(0, 8).map((module) => ({
      id: module.moduleId,
      label: module.label,
      kind: inferDiagramKind(`${module.label} ${module.source}`),
      detail: trimToLength(module.source, 240)
    }));
  }

  return [
    {
      id: "terraform-stack",
      label: files[0]?.path.endsWith(".md") ? "Terraform Stack" : titleize(files[0]?.path ?? "Terraform Stack"),
      kind: "compute",
      detail: "Generated Terraform starter"
    }
  ];
};

export const normalizeDiagram = (
  value: unknown,
  modules: GenerationDraft["modules"],
  files: GenerationDraft["files"]
): GenerationDraft["diagram"] => {
  const record = asRecord(value);
  const nodeIds = new Set<string>();
  const rawNodes = Array.isArray(record?.["nodes"]) ? record["nodes"] : [];
  const nodes = rawNodes
    .map((entry, index) => {
      const node = asRecord(entry);
      const label = trimToLength(
        readTextFromKeys(node, ["label", "title", "name"]) ?? `Node ${index + 1}`,
        80
      );
      const generatedNodeId = toSlug(label);
      const baseId = trimToLength(
        readTextFromKeys(node, ["id", "key", "name"]) ?? (generatedNodeId || `node-${index + 1}`),
        64
      );
      const candidateId = nodeIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
      const detail = readTextFromKeys(node, ["detail", "description", "summary", "text"]);
      const fallbackText = [candidateId, label, detail].filter(Boolean).join(" ");
      const normalized: DiagramPlanNode = {
        id: candidateId,
        label,
        kind: normalizeNodeKind(readTextFromKeys(node, ["kind", "type", "category"]), fallbackText)
      };

      if (detail) {
        normalized.detail = trimToLength(detail, 240);
      }

      nodeIds.add(candidateId);
      return normalized;
    })
    .slice(0, 20);

  const finalNodes = nodes.length > 0 ? nodes : buildFallbackNodes(modules, files);
  const finalNodeIds = new Set(finalNodes.map((node) => node.id));
  const rawEdges = Array.isArray(record?.["edges"]) ? record["edges"] : [];
  const edges = rawEdges
    .map((entry) => {
      const edge = asRecord(entry);
      const source = readTextFromKeys(edge, ["source", "from", "start"]);
      const target = readTextFromKeys(edge, ["target", "to", "end"]);
      if (!source || !target || source === target) {
        return undefined;
      }
      if (!finalNodeIds.has(source) || !finalNodeIds.has(target)) {
        return undefined;
      }

      const normalized: DiagramPlanEdge = {
        source,
        target
      };
      const label = readTextFromKeys(edge, ["label", "name", "title"]);
      if (label) {
        normalized.label = trimToLength(label, 120);
      }

      return normalized;
    })
    .filter((edge): edge is DiagramPlanEdge => edge !== undefined)
    .slice(0, 30);

  return {
    nodes: finalNodes,
    edges
  };
};
