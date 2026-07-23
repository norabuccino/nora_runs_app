import { describe, it, expect } from "vitest";
import { byString, byStringDesc, byNumberAsc, byNumberDesc, thenBy } from "@/lib/sortUtils";

interface Item {
  name: string;
  count: number;
}

const items: Item[] = [
  { name: "banana", count: 2 },
  { name: "apple", count: 3 },
  { name: "cherry", count: 1 },
];

describe("byString", () => {
  it("sorts ascending by the given string field", () => {
    const result = [...items].sort(byString((i) => i.name));
    expect(result.map((i) => i.name)).toEqual(["apple", "banana", "cherry"]);
  });
});

describe("byStringDesc", () => {
  it("sorts descending by the given string field", () => {
    const result = [...items].sort(byStringDesc((i) => i.name));
    expect(result.map((i) => i.name)).toEqual(["cherry", "banana", "apple"]);
  });
});

describe("byNumberAsc", () => {
  it("sorts ascending by the given number field", () => {
    const result = [...items].sort(byNumberAsc((i) => i.count));
    expect(result.map((i) => i.count)).toEqual([1, 2, 3]);
  });
});

describe("byNumberDesc", () => {
  it("sorts descending by the given number field", () => {
    const result = [...items].sort(byNumberDesc((i) => i.count));
    expect(result.map((i) => i.count)).toEqual([3, 2, 1]);
  });
});

describe("thenBy", () => {
  it("falls through to the next comparator on a tie", () => {
    const tied: Item[] = [
      { name: "b", count: 1 },
      { name: "a", count: 1 },
      { name: "c", count: 0 },
    ];
    const result = [...tied].sort(
      thenBy(byNumberDesc((i) => i.count), byString((i) => i.name))
    );
    expect(result.map((i) => i.name)).toEqual(["a", "b", "c"]);
  });

  it("uses only the first comparator when it fully resolves order", () => {
    const result = [...items].sort(
      thenBy(byString((i) => i.name), byNumberAsc((i) => i.count))
    );
    expect(result.map((i) => i.name)).toEqual(["apple", "banana", "cherry"]);
  });
});
