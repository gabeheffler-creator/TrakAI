import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chooseDayType } from "./day-type.js";

describe("chooseDayType", () => {
  it("returns training preference when client has a workout log", () => {
    const result = chooseDayType(true);
    assert.equal(result.preferredType, "training");
    assert.equal(result.isTrainingDay, true);
    assert.equal(result.skipToAny, false);
  });

  it("returns rest preference when client has NO workout log for the date", () => {
    const result = chooseDayType(false);
    assert.equal(result.preferredType, "rest");
    assert.equal(result.isTrainingDay, false);
    assert.equal(result.skipToAny, false);
  });

  it("skips to any-day goal when workout-log lookup failed (null)", () => {
    const result = chooseDayType(null);
    assert.equal(result.preferredType, "any");
    assert.equal(result.isTrainingDay, false);
    assert.equal(result.skipToAny, true);
  });
});
