import { beforeEach, describe, expect, test } from "vitest";
import { createLocalSyncService } from "../src/sync/local-sync-service.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

describe("local sync service", () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  test("creates a playable session with teacher code", () => {
    const sync = createLocalSyncService({ storage });
    const session = sync.createSession({ name: "Clase UDESA", totalSprints: 2 });

    expect(session.name).toBe("Clase UDESA");
    expect(session.status).toBe("active");
    expect(session.teacherCode).toMatch(/^T-/);
    expect(session.teams).toEqual([]);
  });

  test("adds a team to a session with a shareable team code", () => {
    const sync = createLocalSyncService({ storage });
    const session = sync.createSession({ name: "Clase UDESA", totalSprints: 2 });
    const team = sync.createTeam({ sessionId: session.id, name: "Equipo 1" });

    expect(team.name).toBe("Equipo 1");
    expect(team.teamCode).toMatch(/^E-/);
    expect(sync.getSession(session.id).teams).toHaveLength(1);
  });

  test("returns a team by id", () => {
    const sync = createLocalSyncService({ storage });
    const session = sync.createSession({ name: "Clase UDESA", totalSprints: 2 });
    const team = sync.createTeam({ sessionId: session.id, name: "Equipo 1" });

    expect(sync.getTeam(team.id)).toEqual(team);
  });

  test("throws a readable error when a team is missing", () => {
    const sync = createLocalSyncService({ storage });

    expect(() => sync.getTeam("team-missing")).toThrow("Team team-missing was not found");
  });

  test("rejects stale team state updates", () => {
    const sync = createLocalSyncService({ storage });
    const session = sync.createSession({ name: "Clase UDESA", totalSprints: 2 });
    const team = sync.createTeam({ sessionId: session.id, name: "Equipo 1" });

    sync.saveTeamState({ teamId: team.id, expectedVersion: 0, state: { currentDay: 1 } });

    expect(() =>
      sync.saveTeamState({ teamId: team.id, expectedVersion: 0, state: { currentDay: 2 } })
    ).toThrow("Team state changed; refresh before saving");
  });

  test("updates session status for teacher controls", () => {
    const sync = createLocalSyncService({ storage });
    const session = sync.createSession({ name: "Clase UDESA", totalSprints: 2 });

    const paused = sync.setSessionStatus({ sessionId: session.id, status: "paused" });

    expect(paused.status).toBe("paused");
    expect(sync.getSession(session.id).status).toBe("paused");
  });
});
