"use client";

import {
  Background,
  Controls,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node
} from "@xyflow/react";
import type { SubmissionDiagram } from "@infrastructure-as-words/contracts";

type SubmissionDiagramProps = {
  diagram: SubmissionDiagram | undefined;
};

const kindColor: Record<string, string> = {
  client: "rgba(38, 84, 124, 0.14)",
  dns: "rgba(83, 122, 78, 0.16)",
  cdn: "rgba(50, 88, 146, 0.16)",
  auth: "rgba(137, 98, 45, 0.18)",
  network: "rgba(88, 73, 124, 0.14)",
  compute: "rgba(41, 94, 90, 0.16)",
  storage: "rgba(48, 122, 106, 0.14)",
  database: "rgba(134, 80, 54, 0.16)",
  queue: "rgba(108, 85, 140, 0.14)",
  integration: "rgba(120, 94, 44, 0.16)",
  observability: "rgba(72, 72, 72, 0.14)"
};

const mapNodes = (diagram: SubmissionDiagram): Node[] =>
  diagram.nodes.map((node) => ({
    ...node,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    draggable: false,
    selectable: false,
    className: "iaw-flowNode",
    style: {
      background: kindColor[node.data.kind] ?? "rgba(17, 24, 39, 0.08)",
      border: "1px solid rgba(17, 24, 39, 0.12)",
      borderRadius: 24,
      color: "#102030",
      boxShadow: "0 18px 50px rgba(17, 24, 39, 0.08)",
      width: 190,
      padding: 14
    }
  }));

const mapEdges = (diagram: SubmissionDiagram): Edge[] =>
  diagram.edges.map((edge) => ({
    ...edge,
    type: "smoothstep",
    animated: edge.animated ?? false,
    selectable: false,
    style: {
      stroke: "rgba(21, 44, 70, 0.38)",
      strokeWidth: 1.4
    },
    labelStyle: {
      fill: "rgba(17, 24, 39, 0.62)",
      fontSize: 11,
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }
  }));

export function SubmissionDiagramCanvas({ diagram }: SubmissionDiagramProps) {
  if (!diagram) {
    return (
      <div className="iaw-diagramEmpty">
        <span className="iaw-ghostLine iaw-ghostLineWide" />
        <span className="iaw-ghostLine iaw-ghostLineMid" />
        <span className="iaw-ghostLine iaw-ghostLineNarrow" />
      </div>
    );
  }

  return (
    <div className="iaw-diagramCanvas">
      <ReactFlowProvider>
        <ReactFlow
          nodes={mapNodes(diagram)}
          edges={mapEdges(diagram)}
          defaultViewport={diagram.viewport}
          minZoom={0.45}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          fitView={false}
          proOptions={{
            hideAttribution: true
          }}
        >
          <Background gap={24} size={1} color="rgba(17, 24, 39, 0.08)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
