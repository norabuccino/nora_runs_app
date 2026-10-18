// Reference text for each loading category (keys of LOADING_CATEGORY_LABELS):
// the movement pattern it covers and examples. Categories group tracked
// exercises on /progression. Shown on /reference and from the exercise form.

import type { GuideEntry } from "@/lib/loadFormatGuide";

export const LOADING_CATEGORY_GUIDE: GuideEntry[] = [
  {
    key: "bilateral_squat",
    meaning: "Both feet planted, knees bending to lower and drive up.",
    whenToUse: "Squat patterns where both legs share the load evenly.",
    examples: "Back squat, goblet squat, heel elevated squat, leg press",
  },
  {
    key: "unilateral_squat",
    meaning: "One leg doing most of the work, knee-dominant.",
    whenToUse: "Split stances, lunges and single-leg squats.",
    examples: "Split squats, curtsy lunges, lateral lunges, step ups, single leg squats",
  },
  {
    key: "bilateral_hinge",
    meaning: "Bend at the hips with a flat back — hamstrings and glutes on both legs.",
    whenToUse: "Hip-dominant lifts with both feet down.",
    examples: "Deadlift, RDL, kettlebell swings, glute bridges, hip thrusts",
  },
  {
    key: "unilateral_hinge",
    meaning: "A hip hinge on one leg.",
    whenToUse: "Single-leg posterior chain work, often with a balance component.",
    examples: "Single leg RDL, kickstand RDL, single leg glute bridge",
  },
  {
    key: "calf",
    meaning: "Ankle and lower leg strength.",
    whenToUse: "Calf raises and other foot/ankle loading.",
    examples: "Calf raises (straight and bent knee), tib bar raises, ankle isos",
  },
  {
    key: "horizontal_push",
    meaning: "Pushing away from your chest.",
    whenToUse: "Press or push straight out in front of you.",
    examples: "Pushups, bench press, dumbbell chest press",
  },
  {
    key: "vertical_push",
    meaning: "Pushing overhead.",
    whenToUse: "Presses that finish with arms above your head.",
    examples: "Overhead press, push press, landmine press",
  },
  {
    key: "upper_pull",
    meaning: "Pulling toward your body, horizontally or from overhead.",
    whenToUse: "Rows and pull-downs/ups.",
    examples: "Rows, gorilla rows, pull up, chin up, cable pulldowns",
  },
  {
    key: "shoulder_isolation",
    meaning: "Small shoulder and upper-back muscles on their own.",
    whenToUse: "Raises and scapular work with light weight.",
    examples: "Lateral raises, ATYT, snow angels, face pulls",
  },
  {
    key: "arm_isolation",
    meaning: "Biceps or triceps on their own.",
    whenToUse: "Single-joint arm exercises.",
    examples: "Curls, tricep extensions, kickbacks",
  },
  {
    key: "hip_isolation",
    meaning: "Hip abductors, adductors and flexors on their own.",
    whenToUse: "Targeted hip work, often banded or lying down.",
    examples: "Clamshells, monster walks, Copenhagen holds, hip flexor marches",
  },
  {
    key: "core_carry",
    meaning: "Trunk strength and anti-rotation, including loaded carries.",
    whenToUse: "Core exercises and walking with weight.",
    examples: "Farmer/suitcase carries, Paloff press, chops, Russian twist, bear crawl holds",
  },
];
