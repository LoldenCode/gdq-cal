import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { WatchStore } from "./watch-store.js";

test("groups keep durable per-person schedules by slug and support removing participants", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gdq-watch-"));
  try {
    const store = new WatchStore(join(dir, "groups.json"));
    const group = await store.joinGroup("pizza-night", "Alden");

    assert.equal(group.slug, "pizza-night");
    assert.deepEqual(group.people.map((person) => person.name), ["Alden"]);

    for (const name of ["Bea", "Cam", "Dee", "Eli", "Fox", "Gia", "Hal"]) {
      await store.joinGroup("pizza-night", name);
    }

    const crowded = await store.getGroup("pizza-night");
    assert.equal(crowded.people.length, 8);

    await store.setSelection("pizza-night", "Alden", "run-1", true);
    await store.setSelection("pizza-night", "Bea", "run-1", true);
    await store.setSelection("pizza-night", "Alden", "run-2", true);
    await store.setSelection("pizza-night", "Alden", "run-1", false);

    const updated = await store.getGroup("pizza-night");
    assert.deepEqual(updated.selectionsByPerson.Alden, ["run-2"]);
    assert.deepEqual(updated.selectionsByPerson.Bea, ["run-1"]);

    await store.removePerson("pizza-night", "Bea");
    const withoutBea = await store.getGroup("pizza-night");
    assert.equal(withoutBea.people.some((person) => person.name === "Bea"), false);
    assert.equal(withoutBea.selectionsByPerson.Bea, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("admin inventory lists every group with members and selections", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gdq-watch-"));
  try {
    const store = new WatchStore(join(dir, "groups.json"));
    await store.setSelection("pizza-night", "Alden", "run-1", true);
    await store.setSelection("pizza-night", "Bea", "run-2", true);
    await store.joinGroup("late-crew", "Cam");

    const groups = await store.listGroups();

    assert.deepEqual(groups.map((group) => group.slug), ["late-crew", "pizza-night"]);
    assert.deepEqual(groups.find((group) => group.slug === "pizza-night").people.map((person) => person.name), ["Alden", "Bea"]);
    assert.deepEqual(groups.find((group) => group.slug === "pizza-night").selectionsByPerson.Alden, ["run-1"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
