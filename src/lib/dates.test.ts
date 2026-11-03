import { describe, expect, it } from "vitest";
import {
  addDays,
  daysAgo,
  formatDueAt,
  formatInstant,
  formatSiteDate,
  localDate,
  parseDueAt,
  toApiDate,
  validDate,
  zoneLabel,
} from "./dates";

describe("toApiDate", () => {
  it("turns an ISO date into the API's DD/MM/YYYY", () => {
    expect(toApiDate("2026-10-06")).toBe("06/10/2026");
  });

  it("refuses anything else", () => {
    expect(() => toApiDate("06/10/2026")).toThrow();
  });
});

describe("calendar and timezone formatting", () => {
  it("validates real dates and handles leap days", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("formats plain dates without applying the computer timezone", () =>
    expect(formatSiteDate("2026-10-07")).toBe("07 Oct 2026"));
  it("converts instants and Unix seconds to the site timezone", () => {
    expect(formatInstant("2026-10-06T02:15:07Z", "Asia/Singapore")).toBe(
      "06 Oct 2026, 10:15 SGT",
    );
    expect(
      formatInstant(Date.parse("2026-10-06T02:15:07Z") / 1000, "Asia/Jakarta"),
    ).toBe("06 Oct 2026, 09:15 WIB");
  });
  it("does not shift an event deadline as if it were UTC", () => {
    expect(parseDueAt("07/10/2026 10:00")).toEqual({
      date: "2026-10-07",
      time: "10:00",
    });
    expect(parseDueAt("31/02/2026 27:00")).toBeNull();
    expect(formatDueAt("07/10/2026 10:00", "Australia/Sydney")).toBe(
      "07 Oct 2026, 10:00 (Australia/Sydney)",
    );
  });
  it("uses daylight saving labels for the actual date", () => {
    expect(
      zoneLabel("Australia/Sydney", new Date("2026-11-03T00:00:00Z")),
    ).toBe("AEDT");
    expect(
      zoneLabel("Australia/Sydney", new Date("2026-06-03T00:00:00Z")),
    ).toBe("AEST");
  });
});

describe("localDate", () => {
  it("is the next day in Sydney when it is still evening in UTC", () => {
    const instant = new Date("2026-10-06T15:30:00Z");
    expect(localDate(instant, "Australia/Sydney")).toBe("2026-10-07");
    expect(localDate(instant, "Asia/Singapore")).toBe("2026-10-06");
  });
});

describe("daysAgo", () => {
  it("counts back across a month boundary", () => {
    expect(daysAgo(30, new Date("2026-10-15T00:00:00Z"))).toBe("2026-09-15");
  });
});
