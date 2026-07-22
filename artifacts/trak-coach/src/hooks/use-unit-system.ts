import { useState } from "react";

export type UnitSystem = "imperial" | "metric";

const KEY = "trak_coach_unit_system";

function read(): UnitSystem {
  const v = localStorage.getItem(KEY);
  return v === "metric" ? "metric" : "imperial";
}

export function useUnitSystem() {
  const [units, setUnitsState] = useState<UnitSystem>(read);

  const setUnits = (u: UnitSystem) => {
    localStorage.setItem(KEY, u);
    setUnitsState(u);
  };

  const weightLabel = units === "metric" ? "kg" : "lbs";
  const lengthLabel = units === "metric" ? "cm" : "in";

  return { units, setUnits, weightLabel, lengthLabel };
}
