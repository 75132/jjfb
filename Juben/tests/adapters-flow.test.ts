import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { graphToFlow } from "../src/editor/adapters";

describe("adapters-flow", () => {
  it("graphToFlow creates nodes and edges from options", () => {
    const graph = createGraph({
      id: "g_flow",
      kind: "mainline",
      nodes: [
        createNode({
          id: "a",
          kind: "dialog",
          position: { x: 0, y: 0 },
          options: [{ id: "o1", text: "next", targetNodeId: "b", targetNodeIds: ["b"] }],
        }),
        createNode({ id: "b", kind: "dialog", position: { x: 200, y: 0 }, options: [] }),
      ],
    });
    const { nodes, edges } = graphToFlow(graph);
    expect(nodes.length).toBe(2);
    expect(edges.some((e) => e.target === "b")).toBe(true);
  });
});
