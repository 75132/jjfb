import { describe, expect, it } from "vitest";
import { canDeleteStoryNode, deleteNodeFromGraph, getDeleteNodeBlockReason } from "../src/editor/adapters";
import { createGraph, createNode } from "../src/types";

describe("deleteNodeFromGraph", () => {
  it("blocks npcEntry on map graphs", () => {
    const graph = createGraph({
      id: "g1",
      kind: "map",
      nodes: [createNode({ id: "e1", kind: "npcEntry", title: "入口" })],
    });
    expect(getDeleteNodeBlockReason(graph, "e1")).toMatch(/NPC 入口/);
    expect(canDeleteStoryNode(graph, "e1")).toBe(false);
    expect(deleteNodeFromGraph(graph, "e1").ok).toBe(false);
    expect(graph.nodes).toHaveLength(1);
  });

  it("deletes regular dialog nodes", () => {
    const graph = createGraph({
      id: "g1",
      kind: "map",
      nodes: [
        createNode({ id: "e1", kind: "npcEntry", title: "入口" }),
        createNode({ id: "n1", kind: "dialog", title: "对话" }),
      ],
    });
    expect(deleteNodeFromGraph(graph, "n1")).toEqual({ ok: true });
    expect(graph.nodes.map((n) => n.id)).toEqual(["e1"]);
  });

  it("blocks ghost flow ids", () => {
    const graph = createGraph({ id: "g1", kind: "mainline", nodes: [] });
    expect(getDeleteNodeBlockReason(graph, "__ghost__n1")).toMatch(/镜像/);
  });
});
