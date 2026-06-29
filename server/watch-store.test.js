import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { WatchStore } from "./watch-store.js";

test("groups keep durable per-person schedules by slug and cap participants at six", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gdq-watch-"));
  try {
    const store = new WatchStore(join(dir, "groups.json"));
    const group = await store.joinGroup("pizza-night", "Alden");

    assert.equal(group.slug, "pizza-night");
    assert.deepEqual(group.people.map((person) => person.name), ["Alden"]);

    for (const name of ["Bea", "Cam", "Dee", "Eli", "Fox"]) {
      await store.joinGroup("pizza-night", name);
    }

    await assert.rejects(
      () => store.joinGroup("pizza-night", "Gia"),
      /group already has six people/i
    );

    await store.setSelection("pizza-night", "Alden", "run-1", true);
    await store.setSelection("pizza-night", "Bea", "run-1", true);
    await store.setSelection("pizza-night", "Alden", "run-2", true);
    await store.setSelection("pizza-night", "Alden", "run-1", false);

    const updated = await store.getGroup("pizza-night");
    assert.deepEqual(updated.selectionsByPerson.Alden, ["run-2"]);
    assert.deepEqual(updated.selectionsByPerson.Bea, ["run-1"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
