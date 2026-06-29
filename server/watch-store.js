import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const MAX_PEOPLE = 24;

function cleanSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!slug) throw new Error("Group slug is required");
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
      if (error?.code === "ENOENT") return { groups: {} };
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

  normalizeData(data) {
    if (!data.groups && data.rooms) {
      data.groups = {};
      for (const [slug, room] of Object.entries(data.rooms)) {
        const selectionsByPerson = {};
        for (const [runId, names] of Object.entries(room.picks || {})) {
          for (const name of names) {
            selectionsByPerson[name] = selectionsByPerson[name] || [];
            selectionsByPerson[name].push(runId);
          }
        }
        data.groups[slug] = {
          slug,
          people: room.people || [],
          selectionsByPerson
        };
      }
      delete data.rooms;
    }
    data.groups = data.groups || {};
    return data;
  }

  emptyGroup(slug) {
    return { slug, people: [], selectionsByPerson: {} };
  }

  async getGroup(slugValue) {
    const slug = cleanSlug(slugValue);
    const data = this.normalizeData(await this.readAll());
    return data.groups[slug] || this.emptyGroup(slug);
  }

  async joinGroup(slugValue, nameValue) {
    const slug = cleanSlug(slugValue);
    const name = cleanName(nameValue);
    return this.update((data) => {
      this.normalizeData(data);
      const group = data.groups[slug] || this.emptyGroup(slug);
      const exists = group.people.some((person) => person.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        if (group.people.length >= MAX_PEOPLE) throw new Error(`Group already has ${MAX_PEOPLE} people`);
        group.people.push({ name, joinedAt: new Date().toISOString() });
      }
      group.selectionsByPerson[name] = group.selectionsByPerson[name] || [];
      data.groups[slug] = group;
      return group;
    });
  }

  async setSelection(slugValue, nameValue, runIdValue, selected) {
    const slug = cleanSlug(slugValue);
    const name = cleanName(nameValue);
    const runId = cleanRunId(runIdValue);
    return this.update((data) => {
      this.normalizeData(data);
      const group = data.groups[slug] || this.emptyGroup(slug);
      const exists = group.people.some((person) => person.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        if (group.people.length >= MAX_PEOPLE) throw new Error(`Group already has ${MAX_PEOPLE} people`);
        group.people.push({ name, joinedAt: new Date().toISOString() });
      }

      const current = new Set(group.selectionsByPerson[name] || []);
      if (selected) current.add(runId);
      else current.delete(runId);

      const next = [...current].sort((a, b) => a.localeCompare(b));
      group.selectionsByPerson[name] = next;

      data.groups[slug] = group;
      return group;
    });
  }

  async removePerson(slugValue, nameValue) {
    const slug = cleanSlug(slugValue);
    const name = cleanName(nameValue);
    return this.update((data) => {
      this.normalizeData(data);
      const group = data.groups[slug] || this.emptyGroup(slug);
      group.people = group.people.filter((person) => person.name.toLowerCase() !== name.toLowerCase());
      for (const key of Object.keys(group.selectionsByPerson)) {
        if (key.toLowerCase() === name.toLowerCase()) delete group.selectionsByPerson[key];
      }
      data.groups[slug] = group;
      return group;
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
