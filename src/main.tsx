import React from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Check, Copy, RefreshCw, Trash2, Users } from "lucide-react";
import { buildDaySeparators, buildTimelinePixels, buildTimelineTicks, type TimelineBlock } from "./timeline-layout";
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

type AdminGroupsResponse = {
  groups: GroupPlan[];
};

const CALENDAR_TOP_GUTTER_PX = 14;
const LAST_GROUP_KEY = "gdq-plan-last-slug";
const JOINED_GROUPS_KEY = "gdq-plan-joined-slugs";

function getInitialSlug() {
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get("group") || params.get("room");
  const pathSlug = window.location.pathname.match(/^\/(?:group|g)\/([^/]+)/)?.[1];
  const cachedSlug = localStorage.getItem(LAST_GROUP_KEY);
  return cleanSlug(querySlug || pathSlug || cachedSlug || "");
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
  if (!slug) return "";
  return localStorage.getItem(`gdq-plan-name:${slug}`) || "";
}

function getJoinedSlugs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(JOINED_GROUPS_KEY) || "[]");
    const storedSlugs = Array.isArray(parsed) ? parsed.map(cleanSlug).filter(Boolean) : [];
    const lastSlug = cleanSlug(localStorage.getItem(LAST_GROUP_KEY) || "");
    return [...new Set([lastSlug, ...storedSlugs].filter(Boolean))];
  } catch {
    return cleanSlug(localStorage.getItem(LAST_GROUP_KEY) || "") ? [cleanSlug(localStorage.getItem(LAST_GROUP_KEY) || "")] : [];
  }
}

function rememberJoinedSlug(slug: string) {
  const next = [slug, ...getJoinedSlugs().filter((storedSlug) => storedSlug !== slug)].slice(0, 12);
  localStorage.setItem(JOINED_GROUPS_KEY, JSON.stringify(next));
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
  onToggle,
  style
}: {
  run: Run;
  group: GroupPlan | null;
  currentName: string;
  onToggle: (runId: string, selected: boolean) => void;
  style?: React.CSSProperties;
}) {
  const joined = Boolean(currentName && group?.people.some((person) => person.name.toLowerCase() === currentName.toLowerCase()));
  const currentSelections = currentName ? group?.selectionsByPerson[currentName] || [] : [];
  const selected = joined && currentSelections.includes(run.id);
  const names = selectedNames(group, run.id);

  return (
    <article className={selected ? "schedule-row selected" : "schedule-row"} style={style}>
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
      <div className="people-cell">{names.length ? names.join(", ") : joined ? "No one yet" : "Join group"}</div>
    </article>
  );
}

function ScheduleCalendar({
  blocks,
  group,
  currentName,
  onToggle,
  daySeparators,
  heightPx,
  scrollRef,
  onScroll
}: {
  blocks: TimelineBlock[];
  group: GroupPlan | null;
  currentName: string;
  onToggle: (runId: string, selected: boolean) => void;
  daySeparators: ReturnType<typeof buildDaySeparators>;
  heightPx: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: React.UIEventHandler<HTMLDivElement>;
}) {
  return (
    <div className="schedule-list" ref={scrollRef} onScroll={onScroll}>
      <div className="schedule-calendar" style={{ height: `${heightPx + CALENDAR_TOP_GUTTER_PX}px` }}>
        {daySeparators.map((separator) => (
          <span className="schedule-dayline" key={separator.timeMs} style={{ top: `${(separator.topPx ?? 0) + CALENDAR_TOP_GUTTER_PX}px` }}>
            {separator.label}
          </span>
        ))}
        {blocks.map((block) => (
          <ScheduleRow
            key={block.run.id}
            run={block.run as Run}
            group={group}
            currentName={currentName}
            onToggle={onToggle}
            style={{ top: `${(block.topPx ?? 0) + CALENDAR_TOP_GUTTER_PX}px`, height: `${block.heightPx ?? 80}px` }}
          />
        ))}
      </div>
    </div>
  );
}

function Timeline({
  group,
  layout,
  ticks,
  daySeparators,
  scrollRef,
  onScroll
}: {
  group: GroupPlan | null;
  layout: ReturnType<typeof buildTimelinePixels>;
  ticks: ReturnType<typeof buildTimelineTicks>;
  daySeparators: ReturnType<typeof buildDaySeparators>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: React.UIEventHandler<HTMLDivElement>;
}) {
  if (!group?.people.length) {
    return <section className="timeline-empty">Join a group and select runs to build the shared viewing calendar.</section>;
  }

  return (
    <>
      <div className="timeline-header">
        <h2>Viewing Calendar</h2>
        <p>Watched runs line up by event time so gaps and overlaps are visible</p>
      </div>
      <section className="timeline">
        <div
          className="timeline-body"
          ref={scrollRef}
          onScroll={onScroll}
          style={{ "--lane-count": group.people.length } as React.CSSProperties}
        >
          <div className="time-axis" aria-hidden="true">
            <div className="axis-track" style={{ height: `${layout.heightPx + CALENDAR_TOP_GUTTER_PX}px` }}>
              {daySeparators.map((separator) => (
                <span className="axis-day-label" key={separator.timeMs} style={{ top: `${(separator.topPx ?? 0) + CALENDAR_TOP_GUTTER_PX}px` }}>{separator.label}</span>
              ))}
              {ticks.map((tick) => (
                <span className="axis-time-label" key={tick.timeMs} style={{ top: `${(tick.topPx ?? 0) + CALENDAR_TOP_GUTTER_PX}px` }}>{formatTime(new Date(tick.timeMs).toISOString())}</span>
              ))}
            </div>
          </div>
          {group.people.map((person) => {
            const blocks = layout.blocksByPerson[person.name] || [];
            return (
              <div className="person-column" key={person.name}>
                <div className="person-lane" style={{ height: `${layout.heightPx + CALENDAR_TOP_GUTTER_PX}px` }}>
                  {ticks.map((tick) => <span className="lane-gridline" key={tick.timeMs} style={{ top: `${(tick.topPx ?? 0) + CALENDAR_TOP_GUTTER_PX}px` }} />)}
                  {daySeparators.map((separator) => (
                    <span
                      className="lane-dayline"
                      key={separator.timeMs}
                      style={{ top: `${(separator.topPx ?? 0) + CALENDAR_TOP_GUTTER_PX}px` }}
                      aria-hidden="true"
                    />
                  ))}
                  {blocks.length ? blocks.map((block) => {
                    return (
                      <article
                      key={block.run.id}
                      className="watch-block"
                      style={{ top: `${(block.topPx ?? 0) + CALENDAR_TOP_GUTTER_PX}px`, height: `${block.heightPx ?? 44}px` }}
                    >
                      <span className="watch-meta">
                        <span className="watch-time">{formatShortTime(block.run.startTime)}</span>
                        <span className="watch-person">{person.name}</span>
                      </span>
                      <span className="watch-title">{block.run.name}</span>
                    </article>
                    );
                  }) : <div className="watch-empty">No runs selected</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function AdminApp() {
  const [adminKey, setAdminKey] = React.useState(() => localStorage.getItem("gdq-admin-key") || "");
  const [groups, setGroups] = React.useState<GroupPlan[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function loadAdminGroups(key = adminKey) {
    if (!key.trim()) {
      setError("Admin password is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/groups", {
        headers: { Accept: "application/json", Authorization: `Bearer ${key}` }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Admin request failed with ${response.status}`);
      }
      localStorage.setItem("gdq-admin-key", key);
      const payload = (await response.json()) as AdminGroupsResponse;
      setGroups(payload.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin view");
    } finally {
      setLoading(false);
    }
  }

  async function removeAdminPerson(slug: string, name: string) {
    setError(null);
    try {
      const response = await fetch(`/api/admin/groups/${encodeURIComponent(slug)}/people`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${adminKey}`
        },
        body: JSON.stringify({ name })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Remove failed with ${response.status}`);
      }
      await loadAdminGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove person");
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">GDQ watch party admin</p>
          <h1>Admin</h1>
          <p className="lede">Review all shared groups and manage members with the server-side admin password.</p>
        </div>
        <div className="hero-actions">
          <a className="button-link secondary" href="/">Planner</a>
        </div>
      </header>

      <section className="admin-login">
        <label>
          Admin password
          <input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="ADMIN_KEY" />
        </label>
        <button type="button" onClick={() => void loadAdminGroups()} disabled={loading}>
          <RefreshCw size={17} aria-hidden="true" />
          {loading ? "Loading" : "Load groups"}
        </button>
      </section>

      {error ? <section className="notice">Admin error: {error}</section> : null}

      <section className="admin-groups">
        {groups.map((group) => (
          <article className="admin-group" key={group.slug}>
            <div className="admin-group-header">
              <div>
                <h2>{group.slug}</h2>
                <p>{group.people.length} planner{group.people.length === 1 ? "" : "s"}</p>
              </div>
              <a className="button-link secondary" href={`/group/${encodeURIComponent(group.slug)}`}>Open</a>
            </div>
            <div className="admin-members">
              {group.people.length ? group.people.map((person) => {
                const selectionCount = group.selectionsByPerson[person.name]?.length || 0;
                return (
                  <div className="admin-member" key={person.name}>
                    <div>
                      <strong>{person.name}</strong>
                      <span>{selectionCount} selected run{selectionCount === 1 ? "" : "s"}</span>
                    </div>
                    <button type="button" className="danger" onClick={() => void removeAdminPerson(group.slug, person.name)}>
                      <Trash2 size={15} aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                );
              }) : <p className="empty-copy">No members yet</p>}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function App() {
  const [slug, setSlug] = React.useState(getInitialSlug);
  const [slugDraft, setSlugDraft] = React.useState(getInitialSlug);
  const [nameDraft, setNameDraft] = React.useState(() => getStoredName(getInitialSlug()));
  const [currentName, setCurrentName] = React.useState(() => getStoredName(getInitialSlug()));
  const [joinedSlugs, setJoinedSlugs] = React.useState(getJoinedSlugs);
  const [group, setGroup] = React.useState<GroupPlan | null>(null);
  const [schedule, setSchedule] = React.useState<ScheduleResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const scheduleScrollRef = React.useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = React.useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = React.useRef(false);
  const shareUrl = slug ? `${window.location.origin}/group/${encodeURIComponent(slug)}` : "";

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
      if (slug) await loadGroup(slug);
      else setGroup(null);
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
      localStorage.setItem(LAST_GROUP_KEY, nextSlug);
      rememberJoinedSlug(nextSlug);
      setJoinedSlugs(getJoinedSlugs());
      setCurrentName(name);
      setSlug(nextSlug);
      setSlugDraft(nextSlug);
      window.history.replaceState(null, "", `/group/${encodeURIComponent(nextSlug)}`);
      setGroup(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join group");
    }
  }

  function switchGroup(nextSlug: string) {
    const cleanNextSlug = cleanSlug(nextSlug);
    if (!cleanNextSlug || cleanNextSlug === slug) return;
    localStorage.setItem(LAST_GROUP_KEY, cleanNextSlug);
    setSlug(cleanNextSlug);
    setSlugDraft(cleanNextSlug);
    window.history.replaceState(null, "", `/group/${encodeURIComponent(cleanNextSlug)}`);
  }

  async function toggleSelection(runId: string, selected: boolean) {
    if (!currentName || !slug) return;
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

  const calendarLayout = React.useMemo(() => {
    return buildTimelinePixels(sortedRuns, group?.selectionsByPerson || {}, {
      pixelsPerHour: 150,
      minBlockHeightPx: 52
    });
  }, [group?.selectionsByPerson, sortedRuns]);
  const timelineTicks = React.useMemo(() => {
    const ticks = buildTimelineTicks(calendarLayout.bounds, 12);
    if (!calendarLayout.bounds) return ticks;
    const duration = Math.max(calendarLayout.bounds.endMs - calendarLayout.bounds.startMs, 1);
    return ticks.map((tick) => ({
      ...tick,
      topPx: ((tick.timeMs - calendarLayout.bounds!.startMs) / duration) * calendarLayout.heightPx
    }));
  }, [calendarLayout]);
  const daySeparators = React.useMemo(() => {
    if (!calendarLayout.bounds) return [];
    const duration = Math.max(calendarLayout.bounds.endMs - calendarLayout.bounds.startMs, 1);
    return buildDaySeparators(calendarLayout.bounds).map((separator) => ({
      ...separator,
      topPx: ((separator.timeMs - calendarLayout.bounds!.startMs) / duration) * calendarLayout.heightPx
    }));
  }, [calendarLayout]);

  function syncScroll(source: HTMLDivElement, target: HTMLDivElement | null) {
    if (!target || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    target.scrollTop = source.scrollTop;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">GDQ watch party planner</p>
          <h1>{schedule?.eventName ?? "Games Done Quick"}</h1>
          <p className="lede">Pick your personal watch schedule, share the group link, and compare everyone&apos;s selections in a timeline before the event starts.</p>
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
          <button type="submit">{slug && slug === cleanSlug(slugDraft) ? "Join group" : "Switch / join"}</button>
          <button type="button" className="secondary" disabled={!shareUrl} onClick={() => void navigator.clipboard.writeText(shareUrl)}>
            <Copy size={16} aria-hidden="true" />
            Copy group link
          </button>
        </form>
        <div className="group-summary">
          <strong>{slug || "No group selected"}</strong>
          {slug ? <span className="share-url">{shareUrl}</span> : <span>Open a shared `/group/name` link or enter a group slug to join.</span>}
          <span><Users size={15} aria-hidden="true" /> {group?.people.length || 0}/24 planners</span>
          <span>{group?.people.map((person) => person.name).join(", ") || (slug ? "No one joined yet" : "Join or switch to a group")}</span>
        </div>
      </section>

      {joinedSlugs.length ? (
        <section className="joined-groups" aria-label="Joined groups">
          <strong>Your groups</strong>
          <div>
            {joinedSlugs.map((joinedSlug) => (
              <button
                type="button"
                className={joinedSlug === slug ? "group-chip active" : "group-chip"}
                key={joinedSlug}
                onClick={() => switchGroup(joinedSlug)}
              >
                {joinedSlug}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <section className="notice">Could not update the group: {error}</section> : null}
      {loading && !schedule ? <section className="notice">Loading the run list...</section> : null}

      <section className="planner-layout">
        <section className="schedule-pane">
          <div className="pane-heading">
            <h2>Schedule</h2>
            <p>{currentName ? `Selecting as ${currentName}` : "Join this group to select your runs"}</p>
          </div>
          <ScheduleCalendar
            blocks={calendarLayout.runBlocks}
            group={group}
            currentName={currentName}
            onToggle={toggleSelection}
            daySeparators={daySeparators}
            heightPx={calendarLayout.heightPx}
            scrollRef={scheduleScrollRef}
            onScroll={(event) => syncScroll(event.currentTarget, timelineScrollRef.current)}
          />
        </section>
        <aside className="waterfall-pane">
          <Timeline
            group={group}
            layout={calendarLayout}
            ticks={timelineTicks}
            daySeparators={daySeparators}
            scrollRef={timelineScrollRef}
            onScroll={(event) => syncScroll(event.currentTarget, scheduleScrollRef.current)}
          />
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(window.location.pathname.startsWith("/admin") ? <AdminApp /> : <App />);
