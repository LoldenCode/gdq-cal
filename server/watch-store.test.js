import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { WatchStore } from "./watch-store.js";

test("rooms keep shared run picks by slug and cap participants at six", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gdq-watch-"));
  try {
    const store = new WatchStore(join(dir, "rooms.json"));
    const room = await store.joinRoom("pizza-night", "Alden");

    assert.equal(room.slug, "pizza-night");
    assert.deepEqual(room.people.map((person) => person.name), ["Alden"]);

    for (const name of ["Bea", "Cam", "Dee", "Eli", "Fox"]) {
      await store.joinRoom("pizza-night", name);
    }

    await assert.rejects(
      () => store.joinRoom("pizza-night", "Gia"),
      /room already has six people/i
    );

    await store.setPick("pizza-night", "Alden", "run-1", true);
    await store.setPick("pizza-night", "Bea", "run-1", true);
    await store.setPick("pizza-night", "Alden", "run-2", true);
    await store.setPick("pizza-night", "Alden", "run-1", false);

    const updated = await store.getRoom("pizza-night");
    assert.deepEqual(updated.picks["run-1"], ["Bea"]);
    assert.deepEqual(updated.picks["run-2"], ["Alden"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
