import { describe, it, expect } from "vitest";
import { LOAD_FORMAT_LABELS } from "@/lib/paceUtils";
import { LOAD_FORMAT_GUIDE } from "@/lib/loadFormatGuide";

describe("LOAD_FORMAT_GUIDE", () => {
  it("covers every load format exactly once", () => {
    expect(LOAD_FORMAT_GUIDE.map((e) => e.key).sort()).toEqual(Object.keys(LOAD_FORMAT_LABELS).sort());
  });
});
