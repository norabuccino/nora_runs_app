"use client";

import { useState, useEffect } from "react";
import type { GlobalUnit } from "@/lib/unitUtils";

const KEY = "unitPref";
const EVENT = "unitPrefChanged";

function readStored(): GlobalUnit {
  if (typeof window === "undefined") return "mi";
  return localStorage.getItem(KEY) === "km" ? "km" : "mi";
}

export function useUnitPreference(): [GlobalUnit, (unit: GlobalUnit) => void] {
  const [unit, setUnit] = useState<GlobalUnit>("mi");

  useEffect(() => {
    // Read initial value from localStorage
    setUnit(readStored());

    // Stay in sync when another instance of this hook changes the preference
    function handler() {
      setUnit(readStored());
    }
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  function setAndPersist(newUnit: GlobalUnit) {
    localStorage.setItem(KEY, newUnit);
    setUnit(newUnit);
    // Notify every other useUnitPreference instance on the page
    window.dispatchEvent(new Event(EVENT));
  }

  return [unit, setAndPersist];
}
