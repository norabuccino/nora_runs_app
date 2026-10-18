import { describe, it, expect } from "vitest";
import { LOAD_FORMAT_LABELS, LOADING_CATEGORY_LABELS } from "@/lib/paceUtils";
import { LOADING_CATEGORY_GUIDE } from "@/lib/loadingCategoryGuide";
import { LOAD_FORMAT_GUIDE } from "@/lib/loadFormatGuide";

describe("LOAD_FORMAT_GUIDE", () => {
  it("covers every load format exactly once", () => {
    expect(LOAD_FORMAT_GUIDE.map((e) => e.key).sort()).toEqual(Object.keys(LOAD_FORMAT_LABELS).sort());
  });
});

describe("LOADING_CATEGORY_GUIDE", () => {
  it("covers every loading category exactly once", () => {
    expect(LOADING_CATEGORY_GUIDE.map((e) => e.key).sort()).toEqual(Object.keys(LOADING_CATEGORY_LABELS).sort());
  });
});
