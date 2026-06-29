import React from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Check, Clock, Copy, RefreshCw, Sparkles, Users } from "lucide-react";
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

type RunGroup = {
  title: string;
  subtitle: string;
  runs: Run[];
};

type Room = {
  slug: string;
  people: Array<{ name: string; joinedAt: string }>;
  picks: Record<string, string[]>;
};

function getInitialSlug() {
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get("room");
  if (querySlug) return querySlug;
  const pathSlug = window.location.pathname.match(/^\/r\/([^/]+)/)?.[1];
  return pathSlug || "main";
}

function cleanSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatTime(value: string | null) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(value: string) {
  if (!value) return "Estimate TBD";
  return value.replace(/^0 days?,?\s*/i, "").replace(/^0:/, "");
}

function getGroups(runs: Run[]): RunGroup[] {
  const now = Date.now();
  const sorted = [...runs].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
  const currentIndex = sorted.findIndex((run, index) => {
    const start = run.startTime ? new Date(run.startTime).getTime() : 0;
    const next = sorted[index + 1]?.startTime ? new Date(sorted[index + 1].startTime as string).getTime() : Number.MAX_SAFE_INTEGER;
    return start <= now && now < next;
  });
  const upcomingStart = currentIndex >= 0 ? currentIndex : sorted.findIndex((run) => run.startTime && new Date(run.startTime).getTime() >= now);
  const start = upcomingStart >= 0 ? upcomingStart : 0;

  return [
    {
      title: "Now",
      subtitle: "The run to jump into first",
      runs: sorted.slice(start, start + 1)
    },
    {
      title: "Up Next",
      subtitle: "Good moments to rally the group",
      runs: sorted.slice(start + 1, start + 4)
    },
    {
      title: "Later",
      subtitle: "The watchlist for the rest of the session",
      runs: sorted.slice(start + 4, start + 14)
    }
  ];
}

function RunCard({
  run,
  featured = false,
  room,
  currentName,
  onToggle
}: {
  run: Run;
  featured?: boolean;
  room: Room | null;
  currentName: string;
  onToggle: (runId: string, watching: boolean) => void;
}) {
  const watchers = room?.picks[run.id] || [];
  const isWatching = currentName ? watchers.some((name) => name.toLowerCase() === currentName.toLowerCase()) : false;
  return (
    <article className={featured ? "run-card featured" : "run-card"}>
      <div className="run-time">
        <Clock size={16} aria-hidden="true" />
        <span>{formatTime(run.startTime)}</span>
      </div>
      <h3>{run.name}</h3>
      <div className="run-meta">
        <span>{run.category || "Any%"}</span>
        <span>{formatDuration(run.estimate)}</span>
        {run.console ? <span>{run.console}</span> : null}
      </div>
      <div className="runner-line">
        <Users size={16} aria-hidden="true" />
        <span>{run.runners.length ? run.runners.join(", ") : "Runner TBD"}</span>
      </div>
      <div className="watch-row">
        <button className={isWatching ? "watch-button active" : "watch-button"} type="button" disabled={!currentName} onClick={() => onToggle(run.id, !isWatching)}>
          <Check size={16} aria-hidden="true" />
          {isWatching ? "Watching" : "Want to watch"}
        </button>
        <span className="watchers">{watchers.length ? watchers.join(", ") : "No picks yet"}</span>
      </div>
    </article>
  );
}

function App() {
  const [slug, setSlug] = React.useState(getInitialSlug);
  const [slugDraft, setSlugDraft] = React.useState(getInitialSlug);
  const [nameDraft, setNameDraft] = React.useState(() => localStorage.getItem("gdq-watch-name") || "");
  const [currentName, setCurrentName] = React.useState(() => localStorage.getItem("gdq-watch-name") || "");
  const [room, setRoom] = React.useState<Room | null>(null);
  const [schedule, setSchedule] = React.useState<ScheduleResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const shareUrl = `${window.location.origin}/?room=${encodeURIComponent(slug)}`;

  const loadRoom = React.useCallback(async (roomSlug: string) => {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomSlug)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Room request failed with ${response.status}`);
    setRoom(await response.json());
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/schedule", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Schedule request failed with ${response.status}`);
      setSchedule(await response.json());
      await loadRoom(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule request failed");
    } finally {
      setLoading(false);
    }
  }, [loadRoom, slug]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function joinRoom(event: React.FormEvent) {
    event.preventDefault();
    const nextSlug = cleanSlug(slugDraft || slug);
    const name = nameDraft.trim();
    if (!nextSlug || !name) return;
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(nextSlug)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Join failed with ${response.status}`);
      }
      localStorage.setItem("gdq-watch-name", name);
      setCurrentName(name);
      setSlug(nextSlug);
      setSlugDraft(nextSlug);
      window.history.replaceState(null, "", `/?room=${encodeURIComponent(nextSlug)}`);
      setRoom(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join room");
    }
  }

  async function togglePick(runId: string, watching: boolean) {
    if (!currentName) return;
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(slug)}/picks`, {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: currentName, runId, watching })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Pick update failed with ${response.status}`);
      }
      setRoom(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update pick");
    }
  }

  const groups = schedule ? getGroups(schedule.runs) : [];

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow"><Sparkles size={16} aria-hidden="true" /> GDQ watch board</p>
          <h1>{schedule?.eventName ?? "Games Done Quick"}</h1>
          <p className="lede">A shared schedule view for picking the next run, rallying friends, and keeping the stream night moving.</p>
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
      </section>

      <section className="room-panel">
        <form className="join-form" onSubmit={joinRoom}>
          <label>
            Share slug
            <input value={slugDraft} onChange={(event) => setSlugDraft(cleanSlug(event.target.value))} placeholder="pizza-night" />
          </label>
          <label>
            Your name
            <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Alden" />
          </label>
          <button type="submit">Join room</button>
          <button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(shareUrl)}>
            <Copy size={16} aria-hidden="true" />
            Copy link
          </button>
        </form>
        <div className="room-summary">
          <strong>{slug}</strong>
          <span>{room?.people.length || 0}/6 people</span>
          <span>{room?.people.map((person) => person.name).join(", ") || "No one joined yet"}</span>
        </div>
      </section>

      {error ? <section className="notice">Could not load the GDQ schedule: {error}</section> : null}
      {loading && !schedule ? <section className="notice">Loading the run list...</section> : null}

      {groups.map((group, groupIndex) => (
        <section className="run-section" key={group.title}>
          <div className="section-heading">
            <h2>{group.title}</h2>
            <p>{group.subtitle}</p>
          </div>
          <div className={groupIndex === 0 ? "grid single" : "grid"}>
            {group.runs.map((run, index) => (
              <RunCard key={run.id} run={run} featured={groupIndex === 0 && index === 0} room={room} currentName={currentName} onToggle={togglePick} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
