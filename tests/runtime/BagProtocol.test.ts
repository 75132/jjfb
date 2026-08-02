import { describe, expect, it } from "vitest";
import {
  normalizeBagItemsResponse,
  ownedItemIdsFromSnapshot,
} from "../../assets/Script/global/protocol/BagProtocol.ts";

describe("normalizeBagItemsResponse", () => {
  it("parses root-level items", () => {
    const snap = normalizeBagItemsResponse({
      type: "bag_items",
      success: true,
      request_id: "r1",
      items: [
        { item_id: 101, quantity: 2, category: 1 },
        { item_id: 202, quantity: 0, category: 1 },
      ],
      page: 1,
      page_size: 60,
      total_pages: 1,
      total_count: 2,
    });
    expect(snap.success).toBe(true);
    expect(snap.request_id).toBe("r1");
    expect(snap.items).toHaveLength(2);
    expect(snap.items[0]).toEqual({ item_id: 101, quantity: 2, category: 1 });
    const owned = ownedItemIdsFromSnapshot(snap);
    expect(owned.has(101)).toBe(true);
    expect(owned.has(202)).toBe(false);
  });

  it("parses data.items", () => {
    const snap = normalizeBagItemsResponse({
      success: true,
      data: {
        items: [{ item_id: 7, quantity: 3, category: 2 }],
      },
    });
    expect(snap.success).toBe(true);
    expect(snap.items[0].item_id).toBe(7);
    expect(snap.items[0].quantity).toBe(3);
  });

  it("parses legacy data.slots with count", () => {
    const snap = normalizeBagItemsResponse({
      success: true,
      data: {
        slots: [{ itemId: 55, count: 4 }],
      },
    });
    expect(snap.success).toBe(true);
    expect(snap.items[0]).toEqual({ item_id: 55, quantity: 4, category: 1 });
    expect(ownedItemIdsFromSnapshot(snap).has(55)).toBe(true);
  });

  it("success=false yields empty items", () => {
    const snap = normalizeBagItemsResponse({
      type: "bag_items",
      success: false,
      message: "未登录",
      items: [{ item_id: 1, quantity: 9 }],
    });
    expect(snap.success).toBe(false);
    expect(snap.items).toEqual([]);
    expect(snap.message).toContain("未登录");
    expect(ownedItemIdsFromSnapshot(snap).size).toBe(0);
  });

  it("empty bag", () => {
    const snap = normalizeBagItemsResponse({
      success: true,
      items: [],
      total_count: 0,
    });
    expect(snap.success).toBe(true);
    expect(snap.items).toEqual([]);
    expect(ownedItemIdsFromSnapshot(snap).size).toBe(0);
  });

  it("StoryManager ownership: quest item recognizable from root items", () => {
    const snap = normalizeBagItemsResponse({
      success: true,
      items: [{ item_id: 9001, quantity: 1, category: 1 }],
    });
    const owned = ownedItemIdsFromSnapshot(snap);
    expect(owned.has(9001)).toBe(true);
  });
});
