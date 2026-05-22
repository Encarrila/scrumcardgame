import { beforeEach, describe, expect, test, vi } from "vitest";

const client = {
  from: vi.fn()
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => client)
}));

function createSingleResult(row) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: row, error: null })
  };
}

function createTeamSelectResult(row) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: row, error: null })
  };
}

function createTeamListResult(rows) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: rows, error: null })
  };
}

function createMaybeSingleResult(row) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null })
  };
}

function createUpdatedSingleResult(row) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: row, error: null })
  };
}

const sessionRow = {
  id: "session-1",
  name: "Clase Scrum",
  status: "active",
  total_sprints: 2,
  catalog_version: "2026-rrhh",
  teacher_code: "T-ABC123",
  created_at: "2026-05-19T09:00:00.000Z",
  updated_at: "2026-05-19T09:05:00.000Z"
};

const teamRow = {
  id: "team-1",
  session_id: "session-1",
  name: "Equipo 1",
  team_code: "E-ABC123",
  state: { participants: [] },
  state_version: 2,
  created_at: "2026-05-19T10:00:00.000Z",
  updated_at: "2026-05-19T10:05:00.000Z"
};

describe("supabase sync service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("normalizes created teams to the sync provider contract", async () => {
    const builder = createSingleResult(teamRow);
    client.from.mockReturnValue(builder);
    const { createSupabaseSyncService } = await import("../src/sync/supabase-sync-service.js");
    const sync = createSupabaseSyncService({ url: "https://example.test", anonKey: "anon" });

    await expect(sync.createTeam({ sessionId: "session-1", name: "Equipo 1" })).resolves.toMatchObject({
      id: "team-1",
      sessionId: "session-1",
      name: "Equipo 1",
      teamCode: "E-ABC123",
      state: { participants: [] },
      stateVersion: 2
    });
  });

  test("normalizes loaded teams to the sync provider contract", async () => {
    const builder = createTeamSelectResult(teamRow);
    client.from.mockReturnValue(builder);
    const { createSupabaseSyncService } = await import("../src/sync/supabase-sync-service.js");
    const sync = createSupabaseSyncService({ url: "https://example.test", anonKey: "anon" });

    await expect(sync.getTeam("team-1")).resolves.toMatchObject({
      id: "team-1",
      sessionId: "session-1",
      teamCode: "E-ABC123",
      stateVersion: 2
    });
  });

  test("normalizes saved teams to the sync provider contract", async () => {
    const builder = createMaybeSingleResult({ ...teamRow, state_version: 3 });
    client.from.mockReturnValue(builder);
    const { createSupabaseSyncService } = await import("../src/sync/supabase-sync-service.js");
    const sync = createSupabaseSyncService({ url: "https://example.test", anonKey: "anon" });

    await expect(
      sync.saveTeamState({ teamId: "team-1", expectedVersion: 2, state: { participants: [] } })
    ).resolves.toMatchObject({
      id: "team-1",
      sessionId: "session-1",
      teamCode: "E-ABC123",
      stateVersion: 3
    });
  });

  test("loads a session with normalized teams for the teacher dashboard", async () => {
    const sessionBuilder = createTeamSelectResult(sessionRow);
    const teamsBuilder = createTeamListResult([teamRow]);
    client.from.mockReturnValueOnce(sessionBuilder).mockReturnValueOnce(teamsBuilder);
    const { createSupabaseSyncService } = await import("../src/sync/supabase-sync-service.js");
    const sync = createSupabaseSyncService({ url: "https://example.test", anonKey: "anon" });

    await expect(sync.getSession("session-1")).resolves.toMatchObject({
      id: "session-1",
      name: "Clase Scrum",
      status: "active",
      totalSprints: 2,
      catalogVersion: "2026-rrhh",
      teacherCode: "T-ABC123",
      teams: [
        {
          id: "team-1",
          sessionId: "session-1",
          teamCode: "E-ABC123",
          stateVersion: 2
        }
      ]
    });
  });

  test("updates session status for teacher controls", async () => {
    const builder = createUpdatedSingleResult({ ...sessionRow, status: "paused" });
    client.from.mockReturnValue(builder);
    const { createSupabaseSyncService } = await import("../src/sync/supabase-sync-service.js");
    const sync = createSupabaseSyncService({ url: "https://example.test", anonKey: "anon" });

    await expect(sync.setSessionStatus({ sessionId: "session-1", status: "paused" })).resolves.toMatchObject({
      id: "session-1",
      status: "paused",
      totalSprints: 2
    });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "paused" }));
  });
});
