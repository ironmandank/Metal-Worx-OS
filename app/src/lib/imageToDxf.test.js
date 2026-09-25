import { describe, expect, it } from "vitest";
import {
  assignAutomaticCutOrder,
  analyzeSourceArtwork,
  buildAutomaticBridges,
  buildCutSequence,
  buildCorelSvg,
  buildDxf,
  cleanTracePaths,
  countTraceNodes,
  findUnbridgedInteriorPaths,
  getArtworkFileSupport,
  inspectLaserFile,
  prepareBinaryImageData,
  reduceTraceToNodeBudget,
} from "./imageToDxf";

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

  it("puts scoring paths on a blue score layer", () => {
    const result = buildDxf({
      sourceWidth: 10,
      sourceHeight: 10,
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }],
    }, { widthInches: 1, heightInches: 1, pathRoles: ["engrave"] });
    expect(result.dxf).toContain("LASER_SCORE_MARK_BLUE");
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
    expect(result.svg).toContain('id="SCORE_MARK_BLUE"');
    expect(result.svg).toContain('stroke="#0000ff"');
    expect(result.svg).toContain('stroke="#ff0000"');
  });

  it("exports a bridged contour as open DXF pieces with a real gap", () => {
    const result = buildDxf({
      sourceWidth: 10,
      sourceHeight: 10,
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }],
    }, {
      widthInches: 1,
      heightInches: 1,
      pathRoles: ["intact"],
      bridges: [{ pathIndex: 0, position: 0.125 }],
      bridgeWidthInches: 0.05,
    });
    expect(result.dxf).toContain("POLYLINE\n8\nLASER_CUT_FIRST_BLACK\n62\n7\n66\n1\n70\n0");
    expect(result.dxf).not.toContain("POLYLINE\n8\nLASER_CUT_FIRST_BLACK\n62\n7\n66\n1\n70\n1");
  });

  it("assigns top-level contours red and contained contours black", () => {
    const roles = assignAutomaticCutOrder({
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] },
        { points: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 4 }] },
      ],
    });
    expect(roles).toEqual(["cut", "intact"]);
  });

  it("removes unnecessary nodes while preserving a closed shape", () => {
    const cleaned = cleanTracePaths({
      sourceWidth: 10,
      sourceHeight: 10,
      paths: [{ points: [{ x: 0, y: 0 }, { x: 5, y: 0.01 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }],
    }, { widthInches: 10, toleranceInches: 0.05 });
    expect(cleaned.paths[0].points.length).toBeLessThan(5);
    expect(cleaned.paths[0].points.length).toBeGreaterThanOrEqual(3);
  });

  it("reduces dense production paths toward a node budget", () => {
    const points = Array.from({ length: 360 }, (_, index) => {
      const angle = index / 360 * Math.PI * 2;
      return { x: 50 + Math.cos(angle) * 40, y: 50 + Math.sin(angle) * 40 };
    });
    const result = reduceTraceToNodeBudget({ sourceWidth: 100, sourceHeight: 100, paths: [{ points }] }, {
      widthInches: 10,
      targetNodes: 80,
      toleranceInches: 0.01,
      maxToleranceInches: 0.1,
    });
    expect(result.originalNodeCount).toBe(360);
    expect(result.nodeCount).toBeLessThan(100);
    expect(countTraceNodes(result.trace)).toBe(result.nodeCount);
  });

  it("reports readiness, nodes, and very small red pieces", () => {
    const report = inspectLaserFile({
      sourceWidth: 100, sourceHeight: 100,
      paths: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
    }, { widthInches: 1, heightInches: 1, pathRoles: ["cut"] });
    expect(report.status).toBe("unsafe");
    expect(report.smallPieces).toBe(1);
    expect(report.nodeCount).toBe(3);
    expect(report.pathCount).toBe(1);
    expect(report.activeLayerCount).toBe(1);
    expect(report.artworkComplexity.label).toBe("Simple Artwork");
  });

  it("recognizes a simple one-color source image", () => {
    const analysis = analyzeSourceArtwork({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        0, 0, 0, 255, 255, 255, 255, 255,
        0, 0, 0, 255, 255, 255, 255, 255,
      ]),
    });
    expect(analysis.label).toBe("One-Color / Silhouette");
    expect(analysis.complexityTier).toBe(1);
    expect(analysis.colorGroupCount).toBe(2);
  });

  it("recognizes a varied source image as complex", () => {
    const pixels = [];
    for (let index = 0; index < 64; index += 1) {
      pixels.push((index * 37) % 256, (index * 71) % 256, (index * 113) % 256, 255);
    }
    const analysis = analyzeSourceArtwork({ width: 8, height: 8, data: new Uint8ClampedArray(pixels) });
    expect(analysis.label).toBe("Photo / Complex Image");
    expect(analysis.complexityTier).toBe(4);
  });

  it("routes supported artwork files to the correct intake workflow", () => {
    expect(getArtworkFileSupport({ name: "customer-art.pdf", type: "application/pdf" })).toMatchObject({ renderMode: "pdf", canTrace: true });
    expect(getArtworkFileSupport({ name: "logo.svg", type: "image/svg+xml" })).toMatchObject({ renderMode: "image", canTrace: true });
    expect(getArtworkFileSupport({ name: "laser-file.dxf" })).toMatchObject({ renderMode: "vector-review", canTrace: false });
    expect(getArtworkFileSupport({ name: "original.cdr" })).toMatchObject({ renderMode: "vector-review", canTrace: false });
  });

  it("orders blue marks, black interiors, and red exteriors in production order", () => {
    const sequence = buildCutSequence({
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
        { points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }] },
        { points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] },
      ],
    }, ["cut", "engrave", "intact"]);
    expect(sequence.map((entry) => entry.role)).toEqual(["engrave", "intact", "cut"]);
    expect(sequence.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
  });

  it("adds balanced bridge suggestions only to unbridged black paths", () => {
    const trace = {
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }] },
        { points: [{ x: 5, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 8 }] },
      ],
    };
    const bridges = buildAutomaticBridges(trace, {
      pathRoles: ["intact", "cut"],
      bridges: [],
      bridgesPerPath: 2,
    });
    expect(bridges).toEqual([
      { pathIndex: 0, position: 0.25, automatic: true },
      { pathIndex: 0, position: 0.75, automatic: true },
    ]);
    expect(findUnbridgedInteriorPaths(trace, { pathRoles: ["intact", "cut"], bridges })).toEqual([]);
  });
});
