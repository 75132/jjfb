import { describe, expect, it } from "vitest";
import { clampLogical, logicalToImagePx, logicalToParentLocal, snapImageToLogical } from "../src/editor/tilemap-coords";

describe("tilemap-coords", () => {
  const mapW = 960;
  const mapH = 640;
  const tile = 48;

  it("snaps image center to logical 24,24 at top-left tile", () => {
    const r = snapImageToLogical(24, 24, mapW, mapH, tile);
    expect(r).toEqual({ x: 24, y: 24 });
  });

  it("converts logical to image Y (down-positive)", () => {
    const p = logicalToImagePx(192, 192, mapH, tile);
    expect(p.x).toBe(192);
    expect(p.y).toBeGreaterThan(0);
  });

  it("clamps logical coords to map bounds", () => {
    const r = clampLogical(9999, -9999, mapW, mapH, tile);
    expect(r.x).toBeGreaterThanOrEqual(24);
    expect(r.y).toBeLessThanOrEqual(24);
  });

  it("maps logical coords to parent local (top-left origin, Y down in parent)", () => {
    const bounds = { minX: 0, maxY: 0, minY: -720 };
    expect(logicalToParentLocal(120, -24, bounds, tile)).toEqual({ x: 120, y: -72 });
    expect(logicalToParentLocal(120, 24, bounds, tile)).toEqual({ x: 120, y: -24 });
  });
});
