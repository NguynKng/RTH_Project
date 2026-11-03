import { describe, expect, it } from "vitest";
import { matchesSearch, normalise } from "./search";
describe("request search", () => {
  it("ignores accents, case and surrounding whitespace", () =>
    expect(normalise("  José  TAN  ")).toBe("jose tan"));
  it("matches terms across different current fields", () =>
    expect(
      matchesSearch("  josé singapore ", [
        "WO-41210",
        "Room too warm",
        "José Tan",
        "Singapore",
      ]),
    ).toBe(true));
  it("allows an empty query and rejects partial missing terms", () => {
    expect(matchesSearch(" ", ["anything"])).toBe(true);
    expect(matchesSearch("lift missing", ["Lift lobby"])).toBe(false);
  });
});
