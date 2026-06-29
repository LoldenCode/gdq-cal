import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WatchStore, parseJsonBody } from "./watch-store.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "..", "dist");
const port = Number(process.env.PORT || 3000);
const eventId = Number(process.env.GDQ_EVENT_ID || 66);
const trackerBaseUrl = process.env.GDQ_TRACKER_BASE_URL || "https://tracker.gamesdonequick.com/tracker/api/v2";
const cacheMs = Number(process.env.SCHEDULE_CACHE_MS || 120000);
const dataFile = process.env.DATA_FILE || join(__dirname, "..", "data", "watch-plans.json");
const adminKey = process.env.ADMIN_KEY || "";
const watchStore = new WatchStore(dataFile);

let cachedSchedule = null;
let cachedAt = 0;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}

function getMimeType(pathname) {
  const ext = extname(pathname);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function unwrapResults(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function isAdminAuthorized(req) {
  if (!adminKey) return false;
  return req.headers.authorization === `Bearer ${adminKey}`;
}

function requireAdmin(req, res) {
  if (!adminKey) {
    json(res, 404, { error: "Admin access is not configured" });
    return false;
  }
  if (!isAdminAuthorized(req)) {
    json(res, 401, { error: "Admin password required" });
    return false;
  }
  return true;
}

function normalizeRunner(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.name || value.stream || value.username || null;
}

function normalizeRun(run, index) {
  const runners = unwrapResults(run.runners || run.run?.runners)
    .map(normalizeRunner)
    .filter(Boolean);
  return {
    id: String(run.id || run.pk || index),
    name: run.name || run.display_name || run.game || "Untitled run",
    category: run.category || run.run_type || "",
    runners,
    startTime: run.starttime || run.start_time || run.scheduled || null,
    endTime: run.endtime || run.end_time || null,
    estimate: run.estimate || run.run_time || "",
    console: run.console || run.platform || "",
    position: Number(run.order || run.sort_order || index)
  };
}

async function fetchSchedule() {
  const now = Date.now();
  if (cachedSchedule && now - cachedAt < cacheMs) return cachedSchedule;

  const [eventResponse, runsResponse] = await Promise.all([
    fetch(`${trackerBaseUrl}/events/${eventId}/`),
    fetch(`${trackerBaseUrl}/events/${eventId}/runs/`)
  ]);

  if (!eventResponse.ok) throw new Error(`GDQ event request failed with ${eventResponse.status}`);
  if (!runsResponse.ok) throw new Error(`GDQ runs request failed with ${runsResponse.status}`);

  const event = await eventResponse.json();
  const runPayload = await runsResponse.json();
  const runs = unwrapResults(runPayload).map(normalizeRun).sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.position - b.position;
  });

  cachedSchedule = {
    eventName: event.name || event.short || "Games Done Quick",
    eventShort: event.short || "",
    eventId,
    updatedAt: new Date().toISOString(),
    runs
  };
  cachedAt = now;
  return cachedSchedule;
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url || "/", "http://localhost");
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const safePath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = safePath === "/" ? join(publicDir, "index.html") : join(publicDir, safePath);
  const target = existsSync(filePath) ? filePath : join(publicDir, "index.html");
  res.writeHead(200, { "content-type": getMimeType(target) });
  createReadStream(target).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/api/health") return json(res, 200, { ok: true });
    if (url.pathname === "/api/schedule") return json(res, 200, await fetchSchedule());
    if (url.pathname === "/api/admin/groups") {
      if (!requireAdmin(req, res)) return;
      if (req.method === "GET") return json(res, 200, { groups: await watchStore.listGroups() });
    }
    if (url.pathname.startsWith("/api/admin/groups/")) {
      if (!requireAdmin(req, res)) return;
      const [, , , , rawSlug] = url.pathname.split("/");
      if (req.method === "DELETE" && url.pathname.endsWith("/people")) {
        const body = await parseJsonBody(req);
        return json(res, 200, await watchStore.removePerson(rawSlug, body.name));
      }
    }
    if (url.pathname.startsWith("/api/groups/")) {
      const [, , , rawSlug] = url.pathname.split("/");
      if (req.method === "GET") return json(res, 200, await watchStore.getGroup(rawSlug));
      if (req.method === "POST" && url.pathname.endsWith("/join")) {
        const body = await parseJsonBody(req);
        return json(res, 200, await watchStore.joinGroup(rawSlug, body.name, body.password, body.selections));
      }
      if (req.method === "POST" && url.pathname.endsWith("/selections")) {
        const body = await parseJsonBody(req);
        return json(res, 200, await watchStore.setSelection(rawSlug, body.name, body.runId, Boolean(body.selected), body.password));
      }
    }
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "API route not found" });
    if (!existsSync(publicDir)) {
      const message = await readFile(join(__dirname, "missing-build.html"), "utf8").catch(() => "Build output is missing.");
      res.writeHead(503, { "content-type": "text/html; charset=utf-8" });
      return res.end(message);
    }
    return serveStatic(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = /required|people|invalid|password/i.test(message) ? 400 : 500;
    return json(res, status, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`GDQ watch board listening on ${port}`);
});
