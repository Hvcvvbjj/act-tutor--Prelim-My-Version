import { describe, expect, it } from "vitest";

import { classifyScoutIntent } from "./scout";

describe("Scout intent classification", () => {
  it("routes calibration definitions before generic plain-English requests", () => {
    expect(
      classifyScoutIntent({
        question: "What does margin of error mean in regular English?",
        hasSelectedText: false,
      }),
    ).toBe("calibration-definition");
  });

  it("treats a selected text request as selection-specific", () => {
    expect(
      classifyScoutIntent({
        question: "Explain this",
        hasSelectedText: true,
      }),
    ).toBe("selection-explanation");
  });

  it("keeps plan questions separate from lesson simplification", () => {
    expect(
      classifyScoutIntent({
        question: "Why is this my next mission?",
        hasSelectedText: false,
      }),
    ).toBe("plan-reason");
  });
});
