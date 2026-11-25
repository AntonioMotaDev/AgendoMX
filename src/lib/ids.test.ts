import { describe, expect, it } from "vitest";
import { isUuid } from "./ids";

describe("isUuid", () => {
  it("accepts real uuids and rejects everything else", () => {
    expect(isUuid("3f2b8c1e-5a4d-4b7e-9c1a-2d3e4f5a6b7c")).toBe(true);
    expect(isUuid("3F2B8C1E-5A4D-4B7E-9C1A-2D3E4F5A6B7C")).toBe(true);
    for (const bad of ["no-es-un-uuid", "", "123", "3f2b8c1e5a4d4b7e9c1a2d3e4f5a6b7c", "3f2b8c1e-5a4d-4b7e-9c1a-2d3e4f5a6b7c; DROP TABLE services", null, undefined, 42]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});
