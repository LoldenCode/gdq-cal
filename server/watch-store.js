import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const MAX_PEOPLE = 6;

function cleanSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!slug) throw new Error("Room slug is required");
  return slug;
}

function cleanName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 32);
  if (!name) throw new Error("Name is required");
  return name;
}

function cleanRunId(value) {
  const runId = String(value || "").trim();
  if (!runId) throw new Error("Run id is required");
  return runId;
}

export class WatchStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeChain = Promise.resolve();
  }

  async readAll() {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return { rooms: {} };
      throw error;
    }
  }

  async writeAll(data) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async update(mutator) {
    const operation = this.writeChain.catch(() => undefined).then(async () => {
      const data = await this.readAll();
      const result = mutator(data);
      await this.writeAll(data);
      return result;
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  async getRoom(slugValue) {
    const slug = cleanSlug(slugValue);
    const data = await this.readAll();
    return data.rooms[slug] || { slug, people: [], picks: {} };
  }

  async joinRoom(slugValue, nameValue) {
    const slug = cleanSlug(slugValue);
    const name = cleanName(nameValue);
    return this.update((data) => {
      const room = data.rooms[slug] || { slug, people: [], picks: {} };
      const exists = room.people.some((person) => person.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        if (room.people.length >= MAX_PEOPLE) throw new Error("Room already has six people");
        room.people.push({ name, joinedAt: new Date().toISOString() });
      }
      data.rooms[slug] = room;
      return room;
    });
  }

  async setPick(slugValue, nameValue, runIdValue, watching) {
    const slug = cleanSlug(slugValue);
    const name = cleanName(nameValue);
    const runId = cleanRunId(runIdValue);
    return this.update((data) => {
      const room = data.rooms[slug] || { slug, people: [], picks: {} };
      const exists = room.people.some((person) => person.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        if (room.people.length >= MAX_PEOPLE) throw new Error("Room already has six people");
        room.people.push({ name, joinedAt: new Date().toISOString() });
      }

      const current = new Set(room.picks[runId] || []);
      if (watching) current.add(name);
      else current.delete(name);

      const next = [...current].sort((a, b) => a.localeCompare(b));
      if (next.length) room.picks[runId] = next;
      else delete room.picks[runId];

      data.rooms[slug] = room;
      return room;
    });
  }
}

export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
