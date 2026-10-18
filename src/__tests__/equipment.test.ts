import { describe, it, expect } from "vitest";
import {
  EQUIPMENT,
  sortEquipment,
  toggleEquipment,
  applyEquipmentChange,
  parseEquipment,
  formatEquipment,
} from "@/lib/equipment";

describe("equipment tag list", () => {
  it("has unique keys including the examples asked for", () => {
    expect(new Set(EQUIPMENT).size).toBe(EQUIPMENT.length);
    expect(EQUIPMENT).toEqual(expect.arrayContaining(["resistance_band", "mini_band", "trx", "box_step", "mat", "assisted_machine"]));
  });

  it("sorts into list order and drops unknown keys", () => {
    expect(sortEquipment(["trx", "dumbbells", "spaceship", "trx"])).toEqual(["dumbbells", "trx"]);
    expect(sortEquipment(null)).toEqual([]);
  });

  it("toggles an item on and off", () => {
    expect(toggleEquipment(["trx"], "dumbbells")).toEqual(["dumbbells", "trx"]);
    expect(toggleEquipment(["dumbbells", "trx"], "trx")).toEqual(["dumbbells"]);
  });

  it("applies bulk add/remove without disturbing other items", () => {
    expect(applyEquipmentChange(["mini_band"], { add: ["box_step"] })).toEqual(["mini_band", "box_step"]);
    expect(applyEquipmentChange(["mini_band", "box_step"], { remove: ["mini_band"] })).toEqual(["box_step"]);
  });

  it("parses labels, keys and common aliases case-insensitively", () => {
    expect(parseEquipment("Mini band; TRX; box; DB; Tennis ball")).toEqual({
      tags: ["dumbbells", "mini_band", "trx", "box_step", "small_ball"],
      unknown: [],
    });
  });

  it("includes the squat rack (overcoming isometrics under the pins)", () => {
    expect(parseEquipment("Squat rack; rack").tags).toEqual(["squat_rack"]);
  });

  it("reports unknown equipment separately", () => {
    expect(parseEquipment("Kettlebell; Rowing machine")).toEqual({ tags: ["kettlebell"], unknown: ["Rowing machine"] });
  });

  it("formats as labels and round-trips through parse", () => {
    const text = formatEquipment(["box_step", "resistance_band"]);
    expect(text).toBe("Resistance band; Box / step");
    expect(parseEquipment(text).tags).toEqual(["resistance_band", "box_step"]);
  });
});
