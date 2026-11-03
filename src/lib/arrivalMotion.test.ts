import { describe, expect, it } from "vitest";
import { planArrivalMotion, type ArrivalFrame } from "./arrivalMotion";

function frame(ids: number[], batch = 0, view = "page:1"): ArrivalFrame {
  return {
    batch,
    view,
    rows: ids.map((id, index) => ({ id, top: 48 + index * 66, height: 66 })),
  };
}

describe("new request push animation", () => {
  it("slides an arriving row in and pushes existing rows by their actual layout displacement", () => {
    expect(planArrivalMotion(frame([1, 2]), frame([3, 1, 2], 1), [3])).toEqual([
      { id: 3, fromY: -32, entering: true, delay: 0 },
      { id: 1, fromY: -66, entering: false, delay: 0 },
      { id: 2, fromY: -66, entering: false, delay: 0 },
    ]);
  });
  it("does not animate the initial load, restored unread rows, ordinary polling or hydration", () => {
    expect(planArrivalMotion(null, frame([1, 2]), [1, 2])).toEqual([]);
    expect(planArrivalMotion(null, frame([1, 2], 4), [1, 2])).toEqual([]);
    expect(planArrivalMotion(frame([1, 2], 1), frame([1, 2], 1), [1])).toEqual(
      [],
    );
    expect(planArrivalMotion(frame([2], 1), frame([3, 2], 1), [3])).toEqual([]);
  });
  it("does not replay when the user changes pages or removes a seen request", () => {
    expect(
      planArrivalMotion(frame([1, 2]), frame([3, 4], 1, "page:2"), [3]),
    ).toEqual([]);
    expect(
      planArrivalMotion(frame([3, 1, 2], 1), frame([1, 2], 1), [3]),
    ).toEqual([]);
  });
  it("stagger-inserts a batch without inventing motion for rows outside the batch", () => {
    const plans = planArrivalMotion(
      frame([3, 2], 1),
      frame([5, 4, 3, 2], 2),
      [5, 4],
    );
    expect(
      plans
        .filter((plan) => plan.entering)
        .map((plan) => [plan.id, plan.delay]),
    ).toEqual([
      [5, 0],
      [4, 40],
    ]);
    expect(
      plans.filter((plan) => !plan.entering).map((plan) => plan.fromY),
    ).toEqual([-132, -132]);
  });
  it("does not move another inbox page when none of the arriving requests are visible", () => {
    expect(planArrivalMotion(frame([1, 2]), frame([3, 1, 2], 1), [99])).toEqual(
      [],
    );
  });
  it("handles wrapped rows using measured positions rather than a hard-coded row height", () => {
    const before: ArrivalFrame = {
      batch: 1,
      view: "page:1",
      rows: [
        { id: 1, top: 48, height: 90 },
        { id: 2, top: 138, height: 66 },
      ],
    };
    const after: ArrivalFrame = {
      batch: 2,
      view: "page:1",
      rows: [
        { id: 3, top: 48, height: 132 },
        { id: 1, top: 180, height: 90 },
        { id: 2, top: 270, height: 66 },
      ],
    };
    expect(
      planArrivalMotion(before, after, [3])
        .filter((plan) => !plan.entering)
        .map((plan) => plan.fromY),
    ).toEqual([-132, -132]);
  });
});
