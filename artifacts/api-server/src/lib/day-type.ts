type DayType = "any" | "training" | "rest";

/**
 * Pure helper — selects which dayType to look up based on whether the client
 * trained on the requested date. Extracted for unit-testability without a DB.
 *
 * - isTraining === true  → prefer "training" goal, isTrainingDay = true
 * - isTraining === false → prefer "rest" goal,     isTrainingDay = false
 * - isTraining === null  → workout-log lookup failed; skip training/rest and
 *                          fall straight through to the "any" goal
 */
export function chooseDayType(isTraining: boolean | null): {
  preferredType: DayType;
  isTrainingDay: boolean;
  skipToAny: boolean;
} {
  if (isTraining === null) {
    return { preferredType: "any", isTrainingDay: false, skipToAny: true };
  }
  return {
    preferredType: isTraining ? "training" : "rest",
    isTrainingDay: isTraining,
    skipToAny: false,
  };
}
