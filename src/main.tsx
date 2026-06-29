import React from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Clock, RefreshCw, Sparkles, Users } from "lucide-react";
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

function RunCard({ run, featured = false }: { run: Run; featured?: boolean }) {
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
    </article>
  );
}

function App() {
  const [schedule, setSchedule] = React.useState<ScheduleResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/schedule", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Schedule request failed with ${response.status}`);
      setSchedule(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

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
              <RunCard key={run.id} run={run} featured={groupIndex === 0 && index === 0} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
