import { describe, expect, it } from "vitest";
import {
  normalizeBagItemsResponse,
  ownedItemIdsFromSnapshot,
  normalizeBagHasItemsResponse,
  ownedItemIdsFromQuantities,
  collectRequirementItemIdsFromMap,
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

describe("bag_has_items for StoryManager", () => {
  it("StoryManager uses bag_has_items quantities (not bag_get page 200)", () => {
    const parsed = normalizeBagHasItemsResponse({
      type: "bag_has_items_response",
      success: true,
      request_id: "bh-1",
      quantities: { "9001": 1, "1002": 0 },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.quantities["9001"]).toBe(1);
    expect(parsed.quantities["1002"]).toBe(0);
    const owned = ownedItemIdsFromQuantities(parsed.quantities);
    expect(owned.has(9001)).toBe(true);
    expect(owned.has(1002)).toBe(false);
  });

  it("quest item beyond bag page 200 still recognized via quantities", () => {
    // bag_get page_size=200 会漏掉第 201 条；bag_has_items 直接按 id 汇总
    const parsed = normalizeBagHasItemsResponse({
      success: true,
      quantities: { "4242": 2 },
    });
    expect(ownedItemIdsFromQuantities(parsed.quantities).has(4242)).toBe(true);
  });

  it("collectRequirementItemIdsFromMap reads appear and server requirements", () => {
    const ids = collectRequirementItemIdsFromMap({
      npcs: [
        {
          npcUid: "a",
          appear: { requirements: [{ type: "item_owned", itemId: 11 }] },
          events: [
            { server: { requirements: [{ type: "item_owned", itemId: 22 }, { type: "level", value: 1 }] } },
          ],
        },
      ],
    });
    expect(ids).toEqual([11, 22]);
  });

  it("multi-stack quantities aggregate for ownership", () => {
    const owned = ownedItemIdsFromQuantities({ "7": 0, "8": 5 });
    expect(owned.has(7)).toBe(false);
    expect(owned.has(8)).toBe(true);
  });
});
