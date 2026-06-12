"use client";

import { useState, useEffect } from "react";
import type { GlobalUnit } from "@/lib/unitUtils";

const KEY = "unitPref";

export function useUnitPreference(): [GlobalUnit, (unit: GlobalUnit) => void] {
  const [unit, setUnit] = useState<GlobalUnit>("mi");

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === "km") setUnit("km");
  }, []);

  function setAndPersist(newUnit: GlobalUnit) {
    localStorage.setItem(KEY, newUnit);
    setUnit(newUnit);
  }

  return [unit, setAndPersist];
}
