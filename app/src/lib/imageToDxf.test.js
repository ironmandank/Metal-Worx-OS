import { describe, expect, it } from "vitest";
import { buildCorelSvg, buildDxf, inspectLaserFile, prepareBinaryImageData } from "./imageToDxf";

describe("image to DXF helpers", () => {
  it("converts pixels to clean black and white data", () => {
    const result = prepareBinaryImageData({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([10, 10, 10, 255, 240, 240, 240, 255]),
    }, { threshold: 128 });
    expect(Array.from(result.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });

  it("writes inch units, closed polylines, and full-scale dimensions", () => {
    const result = buildDxf({
      sourceWidth: 100,
      sourceHeight: 50,
      paths: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }] }],
    }, { widthInches: 20, heightInches: 3, keepAspect: true });
    expect(result.width).toBe(20);
    expect(result.height).toBe(10);
    expect(result.dxf).toContain("$INSUNITS\n70\n1");
    expect(result.dxf).toContain("POLYLINE");
    expect(result.dxf).toContain("VERTEX");
    expect(result.dxf).toContain("LASER_CUT_FIRST_BLACK");
    expect(result.dxf).toContain("10\n20.000000");
  });

  it("puts selected removal paths on a red cut layer", () => {
    const result = buildDxf({
      sourceWidth: 10,
      sourceHeight: 10,
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
    }, { widthInches: 1, heightInches: 1, pathRoles: ["cut"] });
    expect(result.dxf).toContain("LASER_CUT_SECOND_RED");
    expect(result.dxf).toContain("62\n1");
  });

  it("puts engraving paths on a blue engrave layer", () => {
    const result = buildDxf({
      sourceWidth: 10,
      sourceHeight: 10,
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
    }, { widthInches: 1, heightInches: 1, pathRoles: ["engrave"] });
    expect(result.dxf).toContain("LASER_ENGRAVE_BLUE");
    expect(result.dxf).toContain("62\n5");
  });

  it("creates a full-size CorelDRAW SVG with blue, black, and red groups", () => {
    const result = buildCorelSvg({
      sourceWidth: 10, sourceHeight: 10,
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] },
        { points: [{ x: 6, y: 6 }, { x: 9, y: 6 }, { x: 9, y: 9 }] },
        { points: [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 9 }] },
      ],
    }, { widthInches: 2, heightInches: 2, pathRoles: ["intact", "cut", "engrave"] });
    expect(result.svg).toContain('width="2.000000in"');
    expect(result.svg).toContain('id="CUT_FIRST_BLACK"');
    expect(result.svg).toContain('id="CUT_SECOND_RED"');
    expect(result.svg).toContain('id="ENGRAVE_BLUE"');
    expect(result.svg).toContain('stroke="#0000ff"');
    expect(result.svg).toContain('stroke="#ff0000"');
  });

  it("reports readiness, nodes, and very small red pieces", () => {
    const report = inspectLaserFile({
      sourceWidth: 100, sourceHeight: 100,
      paths: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
    }, { widthInches: 1, heightInches: 1, pathRoles: ["cut"] });
    expect(report.status).toBe("unsafe");
    expect(report.smallPieces).toBe(1);
    expect(report.nodeCount).toBe(3);
  });
});
