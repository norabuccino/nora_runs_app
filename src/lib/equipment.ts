// Equipment an exercise needs (multi-select). Not constrained in the database,
// so adding an item here is all it takes; unknown keys are ignored on display.
// An empty list means bodyweight / no equipment (or not yet tagged).

import { createTagList } from "@/lib/tagList";

export const EQUIPMENT_LABELS: Record<string, string> = {
  dumbbells: "Dumbbells",
  kettlebell: "Kettlebell",
  barbell: "Barbell",
  weight_plate: "Weight plate",
  medicine_ball: "Medicine ball",
  resistance_band: "Resistance band",
  mini_band: "Mini band",
  cable_machine: "Cable machine",
  trx: "TRX",
  box_step: "Box / step",
  bench: "Bench",
  bosu: "Bosu",
  foam_roller: "Foam roller",
  sliders: "Sliders",
  yoga_block: "Yoga block",
  mat: "Mat",
  wall: "Wall",
  pull_up_bar: "Pull-up bar",
  assisted_machine: "Assisted pull-up/dip machine",
  squat_rack: "Squat rack",
  tib_bar: "Tib bar",
  leg_press: "Leg press",
  sled: "Sled",
  cone: "Cone",
  small_ball: "Tennis / lacrosse ball",
  towel: "Towel",
};

const equipment = createTagList(EQUIPMENT_LABELS, {
  dumbbell: "dumbbells",
  db: "dumbbells",
  kb: "kettlebell",
  bb: "barbell",
  plate: "weight_plate",
  band: "resistance_band",
  loop_band: "mini_band",
  cable: "cable_machine",
  box: "box_step",
  step: "box_step",
  chair: "box_step",
  slider: "sliders",
  block: "yoga_block",
  yoga_mat: "mat",
  exercise_mat: "mat",
  rack: "squat_rack",
  gravitron: "assisted_machine",
  assisted_pull_up_machine: "assisted_machine",
  assisted_dip_machine: "assisted_machine",
  assisted_pull_up_dip_machine: "assisted_machine",
  power_rack: "squat_rack",
  tennis_ball: "small_ball",
  lacrosse_ball: "small_ball",
});

export const EQUIPMENT = equipment.keys;
export const sortEquipment = equipment.sort;
export const toggleEquipment = equipment.toggle;
export const applyEquipmentChange = equipment.applyChange;
export const parseEquipment = equipment.parse;
export const formatEquipment = equipment.format;
