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
};

export type TimelineBounds = {
  startMs: number;
  endMs: number;
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

export function buildTimelineTicks(bounds: TimelineBounds | null, count = 6) {
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
