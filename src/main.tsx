import React from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Check, Clock, Copy, RefreshCw, Users } from "lucide-react";
import "./styles.css";

type Run = {
  id: string;
  name: string;
  category: string;
  runners: string[];
  startTime: string | null;
  endTime: string | null;
  estimate: string;
  console: string;
  position: number;
};

type ScheduleResponse = {
  eventName: string;
  eventShort: string;
  eventId: number;
  updatedAt: string;
  runs: Run[];
};

type GroupPlan = {
  slug: string;
  people: Array<{ name: string; joinedAt: string }>;
  selectionsByPerson: Record<string, string[]>;
};

function getInitialSlug() {
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get("group") || params.get("room");
  const pathSlug = window.location.pathname.match(/^\/g\/([^/]+)/)?.[1];
  return cleanSlug(querySlug || pathSlug || "agdq-watch");
}

function cleanSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function getStoredName(slug: string) {
  return localStorage.getItem(`gdq-plan-name:${slug}`) || "";
}

function formatTime(value: string | null) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatShortTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(value: string) {
  if (!value) return "Estimate TBD";
  return value.replace(/^0 days?,?\s*/i, "").replace(/^0:/, "");
}

function estimateEnd(run: Run) {
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

function getTimelineBounds(runs: Run[]) {
  const starts = runs.map((run) => (run.startTime ? new Date(run.startTime).getTime() : null)).filter((time): time is number => time !== null);
  const ends = runs.map(estimateEnd).filter((time): time is number => time !== null);
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  return Number.isFinite(min) && Number.isFinite(max) && max > min ? { min, max } : null;
}

function selectedNames(group: GroupPlan | null, runId: string) {
  if (!group) return [];
  return Object.entries(group.selectionsByPerson)
    .filter(([, selections]) => selections.includes(runId))
    .map(([name]) => name);
}

function ScheduleRow({
  run,
  group,
  currentName,
  onToggle
}: {
  run: Run;
  group: GroupPlan | null;
  currentName: string;
  onToggle: (runId: string, selected: boolean) => void;
}) {
  const joined = Boolean(currentName && group?.people.some((person) => person.name.toLowerCase() === currentName.toLowerCase()));
  const currentSelections = currentName ? group?.selectionsByPerson[currentName] || [] : [];
  const selected = joined && currentSelections.includes(run.id);
  const names = selectedNames(group, run.id);

  return (
    <article className={selected ? "schedule-row selected" : "schedule-row"}>
      <button className={selected ? "select-run active" : "select-run"} type="button" disabled={!joined} onClick={() => onToggle(run.id, !selected)} aria-label={`Select ${run.name}`}>
        <Check size={16} aria-hidden="true" />
      </button>
      <div className="time-cell">
        <strong>{formatShortTime(run.startTime)}</strong>
        <span>{formatTime(run.startTime).split(",")[0]}</span>
      </div>
      <div className="run-cell">
        <h3>{run.name}</h3>
        <p>{run.category || "Any%"} · {formatDuration(run.estimate)}{run.console ? ` · ${run.console}` : ""}</p>
        <p className="runners">{run.runners.length ? run.runners.join(", ") : "Runner TBD"}</p>
      </div>
      <div className="people-cell">{names.length ? names.join(", ") : joined ? "No one yet" : "Join to plan"}</div>
    </article>
  );
}

function Timeline({ runs, group }: { runs: Run[]; group: GroupPlan | null }) {
  const bounds = getTimelineBounds(runs);
  const runById = new Map(runs.map((run) => [run.id, run]));
  if (!bounds || !group?.people.length) {
    return <section className="timeline-empty">Join a group and select runs to build the waterfall chart.</section>;
  }
  const duration = bounds.max - bounds.min;

  return (
    <section className="timeline">
      <div className="timeline-header">
        <h2>Viewing Waterfall</h2>
        <p>{formatTime(new Date(bounds.min).toISOString())} to {formatTime(new Date(bounds.max).toISOString())}</p>
      </div>
      <div className="timeline-body">
        {group.people.map((person) => {
          const selections = group.selectionsByPerson[person.name] || [];
          return (
            <div className="timeline-lane" key={person.name}>
              <div className="lane-name">{person.name}</div>
              <div className="lane-track">
                {selections.map((runId) => {
                  const run = runById.get(runId);
                  if (!run?.startTime) return null;
                  const start = new Date(run.startTime).getTime();
                  const end = estimateEnd(run) || start + 45 * 60 * 1000;
                  const left = ((start - bounds.min) / duration) * 100;
                  const width = Math.max(((end - start) / duration) * 100, 2);
                  return (
                    <div className="timeline-block" key={runId} style={{ left: `${left}%`, width: `${width}%` }} title={run.name}>
                      {run.name}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function App() {
  const [slug, setSlug] = React.useState(getInitialSlug);
  const [slugDraft, setSlugDraft] = React.useState(getInitialSlug);
  const [nameDraft, setNameDraft] = React.useState(() => getStoredName(getInitialSlug()));
  const [currentName, setCurrentName] = React.useState(() => getStoredName(getInitialSlug()));
  const [group, setGroup] = React.useState<GroupPlan | null>(null);
  const [schedule, setSchedule] = React.useState<ScheduleResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const shareUrl = `${window.location.origin}/?group=${encodeURIComponent(slug)}`;

  const loadGroup = React.useCallback(async (groupSlug: string) => {
    const response = await fetch(`/api/groups/${encodeURIComponent(groupSlug)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Group request failed with ${response.status}`);
    setGroup(await response.json());
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/schedule", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Schedule request failed with ${response.status}`);
      setSchedule(await response.json());
      await loadGroup(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule request failed");
    } finally {
      setLoading(false);
    }
  }, [loadGroup, slug]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  React.useEffect(() => {
    const storedName = getStoredName(slug);
    setNameDraft(storedName);
    setCurrentName(storedName);
  }, [slug]);

  async function joinGroup(event: React.FormEvent) {
    event.preventDefault();
    const nextSlug = cleanSlug(slugDraft || slug);
    const name = nameDraft.trim();
    if (!nextSlug || !name) return;
    setError(null);
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(nextSlug)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Join failed with ${response.status}`);
      }
      localStorage.setItem(`gdq-plan-name:${nextSlug}`, name);
      setCurrentName(name);
      setSlug(nextSlug);
      setSlugDraft(nextSlug);
      window.history.replaceState(null, "", `/?group=${encodeURIComponent(nextSlug)}`);
      setGroup(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join group");
    }
  }

  async function toggleSelection(runId: string, selected: boolean) {
    if (!currentName) return;
    setError(null);
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(slug)}/selections`, {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: currentName, runId, selected })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Selection update failed with ${response.status}`);
      }
      setGroup(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update schedule");
    }
  }

  const sortedRuns = React.useMemo(() => {
    return [...(schedule?.runs || [])].sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime || a.position - b.position;
    });
  }, [schedule]);

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">GDQ watch party planner</p>
          <h1>{schedule?.eventName ?? "Games Done Quick"}</h1>
          <p className="lede">Pick your personal watch schedule, share the group link, and compare everyone&apos;s plan in a timeline before the event starts.</p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={17} aria-hidden="true" />
            Refresh
          </button>
          <div className="updated">
            <CalendarDays size={16} aria-hidden="true" />
            {schedule ? `Updated ${formatTime(schedule.updatedAt)}` : "Waiting for schedule"}
          </div>
        </div>
      </header>

      <section className="group-panel">
        <form className="join-form" onSubmit={joinGroup}>
          <label>
            Group slug
            <input value={slugDraft} onChange={(event) => setSlugDraft(cleanSlug(event.target.value))} placeholder="discord-watch-party" />
          </label>
          <label>
            Your name
            <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Alden" />
          </label>
          <button type="submit">Join plan</button>
          <button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(shareUrl)}>
            <Copy size={16} aria-hidden="true" />
            Copy link
          </button>
        </form>
        <div className="group-summary">
          <strong>{slug}</strong>
          <span><Users size={15} aria-hidden="true" /> {group?.people.length || 0}/6 planners</span>
          <span>{group?.people.map((person) => person.name).join(", ") || "No one joined yet"}</span>
        </div>
      </section>

      {error ? <section className="notice">Could not update the plan: {error}</section> : null}
      {loading && !schedule ? <section className="notice">Loading the run list...</section> : null}

      <section className="planner-layout">
        <section className="schedule-pane">
          <div className="pane-heading">
            <h2>Schedule</h2>
            <p>{currentName ? `Selecting as ${currentName}` : "Join the group to select your runs"}</p>
          </div>
          <div className="schedule-list">
            {sortedRuns.map((run) => (
              <ScheduleRow key={run.id} run={run} group={group} currentName={currentName} onToggle={toggleSelection} />
            ))}
          </div>
        </section>
        <aside className="waterfall-pane">
          <Timeline runs={sortedRuns} group={group} />
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
