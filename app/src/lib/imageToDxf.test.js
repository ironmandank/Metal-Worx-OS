import { describe, expect, it } from "vitest";
import { buildDxf, prepareBinaryImageData } from "./imageToDxf";

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
    expect(result.dxf).toContain("LWPOLYLINE");
    expect(result.dxf).toContain("10\n20.000000");
  });
});

