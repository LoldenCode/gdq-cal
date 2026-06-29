export type TimelineRun = {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  estimate: string;
};

export type TimelineBlock = {
  run: TimelineRun;
  startMs: number;
  endMs: number;
  topPercent: number;
  heightPercent: number;
  topPx?: number;
  heightPx?: number;
};

export type TimelineBounds = {
  startMs: number;
  endMs: number;
};

export type DaySeparator = {
  timeMs: number;
  percent: number;
  label: string;
  topPx?: number;
};

export type TimelineTick = {
  timeMs: number;
  percent: number;
  topPx?: number;
};

export type TimelinePixelOptions = {
  pixelsPerHour?: number;
  minBlockHeightPx?: number;
};

function estimateEnd(run: TimelineRun) {
  if (run.endTime) return new Date(run.endTime).getTime();
  if (!run.startTime) return null;
  const parts = run.estimate.match(/(?:(\d+)\s+days?,?\s*)?(\d+):(\d+):(\d+)/i);
  if (!parts) return new Date(run.startTime).getTime() + 45 * 60 * 1000;
  const days = Number(parts[1] || 0);
  const hours = Number(parts[2] || 0);
  const minutes = Number(parts[3] || 0);
  const seconds = Number(parts[4] || 0);
  return new Date(run.startTime).getTime() + (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

export function getTimelineBounds(runs: TimelineRun[]): TimelineBounds | null {
  const windows = runs
    .map((run) => {
      if (!run.startTime) return null;
      const startMs = new Date(run.startTime).getTime();
      const endMs = estimateEnd(run);
      if (!Number.isFinite(startMs) || !endMs || !Number.isFinite(endMs)) return null;
      return { startMs, endMs: Math.max(endMs, startMs + 15 * 60 * 1000) };
    })
    .filter((window): window is TimelineBounds => Boolean(window));

  if (!windows.length) return null;
  return {
    startMs: Math.min(...windows.map((window) => window.startMs)),
    endMs: Math.max(...windows.map((window) => window.endMs))
  };
}

export function buildTimelineBlocks(runs: TimelineRun[], selectionsByPerson: Record<string, string[]>) {
  const bounds = getTimelineBounds(runs);
  const runById = new Map(runs.map((run) => [run.id, run]));
  const duration = bounds ? Math.max(bounds.endMs - bounds.startMs, 1) : 1;
  const blocksByPerson: Record<string, TimelineBlock[]> = {};

  for (const [name, selections] of Object.entries(selectionsByPerson)) {
    blocksByPerson[name] = selections
      .map((runId) => {
        const run = runById.get(runId);
        if (!run?.startTime || !bounds) return null;
        const startMs = new Date(run.startTime).getTime();
        const endMs = estimateEnd(run);
        if (!Number.isFinite(startMs) || !endMs || !Number.isFinite(endMs)) return null;
        const safeEndMs = Math.max(endMs, startMs + 15 * 60 * 1000);
        return {
          run,
          startMs,
          endMs: safeEndMs,
          topPercent: ((startMs - bounds.startMs) / duration) * 100,
          heightPercent: Math.max(((safeEndMs - startMs) / duration) * 100, 1.4)
        };
      })
      .filter((block): block is TimelineBlock => Boolean(block))
      .sort((a, b) => a.startMs - b.startMs);
  }

  return { bounds, blocksByPerson };
}

function makeBlock(run: TimelineRun, bounds: TimelineBounds, pixelsPerMs: number, minBlockHeightPx: number): TimelineBlock | null {
  if (!run.startTime) return null;
  const startMs = new Date(run.startTime).getTime();
  const endMs = estimateEnd(run);
  if (!Number.isFinite(startMs) || !endMs || !Number.isFinite(endMs)) return null;
  const safeEndMs = Math.max(endMs, startMs + 15 * 60 * 1000);
  const duration = Math.max(bounds.endMs - bounds.startMs, 1);
  return {
    run,
    startMs,
    endMs: safeEndMs,
    topPercent: ((startMs - bounds.startMs) / duration) * 100,
    heightPercent: Math.max(((safeEndMs - startMs) / duration) * 100, 1.4),
    topPx: (startMs - bounds.startMs) * pixelsPerMs,
    heightPx: Math.max((safeEndMs - startMs) * pixelsPerMs, minBlockHeightPx)
  };
}

export function buildTimelinePixels(
  runs: TimelineRun[],
  selectionsByPerson: Record<string, string[]>,
  options: TimelinePixelOptions = {}
) {
  const bounds = getTimelineBounds(runs);
  const pixelsPerHour = options.pixelsPerHour ?? 58;
  const minBlockHeightPx = options.minBlockHeightPx ?? 44;
  const pixelsPerMs = pixelsPerHour / (60 * 60 * 1000);
  const runById = new Map(runs.map((run) => [run.id, run]));
  const heightPx = bounds ? Math.max((bounds.endMs - bounds.startMs) * pixelsPerMs, 520) : 520;
  const runBlocks = bounds
    ? runs
        .map((run) => makeBlock(run, bounds, pixelsPerMs, minBlockHeightPx))
        .filter((block): block is TimelineBlock => Boolean(block))
        .sort((a, b) => a.startMs - b.startMs)
    : [];
  const blocksByPerson: Record<string, TimelineBlock[]> = {};

  for (const [name, selections] of Object.entries(selectionsByPerson)) {
    blocksByPerson[name] = bounds
      ? selections
          .map((runId) => {
            const run = runById.get(runId);
            return run ? makeBlock(run, bounds, pixelsPerMs, minBlockHeightPx) : null;
          })
          .filter((block): block is TimelineBlock => Boolean(block))
          .sort((a, b) => a.startMs - b.startMs)
      : [];
  }

  return { bounds, heightPx, runBlocks, blocksByPerson };
}

export function buildTimelineTicks(bounds: TimelineBounds | null, count = 6): TimelineTick[] {
  if (!bounds) return [];
  const duration = Math.max(bounds.endMs - bounds.startMs, 1);
  return Array.from({ length: count }, (_, index) => {
    const percent = count === 1 ? 0 : (index / (count - 1)) * 100;
    return {
      timeMs: bounds.startMs + duration * (percent / 100),
      percent
    };
  });
}

export function buildDaySeparators(bounds: TimelineBounds | null): DaySeparator[] {
  if (!bounds) return [];
  const duration = Math.max(bounds.endMs - bounds.startMs, 1);
  const firstDay = new Date(bounds.startMs);
  let nextMidnight = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + 1).getTime();
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  const separators: DaySeparator[] = [];

  while (nextMidnight < bounds.endMs) {
    separators.push({
      timeMs: nextMidnight,
      percent: ((nextMidnight - bounds.startMs) / duration) * 100,
      label: formatter.format(new Date(nextMidnight))
    });
    const current = new Date(nextMidnight);
    nextMidnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1).getTime();
  }

  return separators;
}
