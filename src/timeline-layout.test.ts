import { describe, expect, test } from "bun:test";
import { buildDaySeparators, buildTimelineBlocks } from "./timeline-layout";

const baseRuns = [
  {
    id: "opening",
    name: "Opening run",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-01-01T01:00:00.000Z",
    estimate: "0:45:00"
  },
  {
    id: "late",
    name: "Late run",
    startTime: "2026-01-01T06:00:00.000Z",
    endTime: "2026-01-01T08:00:00.000Z",
    estimate: "2:00:00"
  },
  {
    id: "finale",
    name: "Finale",
    startTime: "2026-01-01T12:00:00.000Z",
    endTime: "2026-01-01T13:00:00.000Z",
    estimate: "1:00:00"
  }
];

describe("buildTimelineBlocks", () => {
  test("places selected runs on a shared time axis so gaps and overlaps are visible", () => {
    const layout = buildTimelineBlocks(baseRuns, {
      Alden: ["opening", "late"],
      Jamie: ["opening", "finale"]
    });

    expect(layout.bounds).not.toBeNull();
    expect(layout.blocksByPerson.Alden[0].topPercent).toBe(layout.blocksByPerson.Jamie[0].topPercent);
    expect(layout.blocksByPerson.Alden[1].topPercent).toBeGreaterThan(layout.blocksByPerson.Alden[0].topPercent + 30);
    expect(layout.blocksByPerson.Alden[1].heightPercent).toBeGreaterThan(layout.blocksByPerson.Alden[0].heightPercent);
    expect(layout.blocksByPerson.Jamie[1].topPercent).toBeGreaterThan(layout.blocksByPerson.Alden[1].topPercent);
  });
});

describe("buildDaySeparators", () => {
  test("places day breaks at local midnight for the viewer timezone", () => {
    const localStart = new Date(2026, 0, 1, 10, 0, 0).getTime();
    const localEnd = new Date(2026, 0, 3, 10, 0, 0).getTime();

    const separators = buildDaySeparators({ startMs: localStart, endMs: localEnd });

    expect(separators.map((separator) => separator.label)).toEqual([
      new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(2026, 0, 2)),
      new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(2026, 0, 3))
    ]);
    expect(separators[0].percent).toBeCloseTo(29.17, 1);
    expect(separators[1].percent).toBeCloseTo(79.17, 1);
  });
});
