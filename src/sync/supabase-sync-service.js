import { createClient } from "@supabase/supabase-js";

function requireConfig(config) {
  if (!config?.url || !config?.anonKey) {
    throw new Error("Supabase config requires url and anonKey");
  }
}

function randomCode(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeSession(row) {
  if (!row) {
    return row;
  }
    return {
        id: row.id,
        name: row.name,
        totalSprints: row.total_sprints,
        status: row.status,
        catalogVersion: row.catalog_version,
        teacherCode: row.teacher_code,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function normalizeTeam(row) {
  if (!row) {
    return row;
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    teamCode: row.team_code,
    state: row.state,
    stateVersion: row.state_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createSupabaseSyncService(config) {
  requireConfig(config);
  const client = createClient(config.url, config.anonKey);

  return {
    async createSession({ name, totalSprints }) {
      const { data, error } = await client
        .from("game_sessions")
        .insert({
          name,
          total_sprints: totalSprints,
          status: "active",
          teacher_code: randomCode("T")
        })
        .select()
        .single();

      if (error) throw error;
      return normalizeSession(data);
    },

    async createTeam({ sessionId, name, initialState = null }) {
      const { data, error } = await client
        .from("teams")
        .insert({
          session_id: sessionId,
          name,
          team_code: randomCode("E"),
          state: initialState,
          state_version: 0
        })
        .select()
        .single();

      if (error) throw error;
      return normalizeTeam(data);
    },

    async getSession(sessionId) {
      const { data: session, error: sessionError } = await client
        .from("game_sessions")
        .select()
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;

      const { data: teams, error: teamsError } = await client
        .from("teams")
        .select()
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (teamsError) throw teamsError;

      return {
        ...normalizeSession(session),
        teams: teams.map(normalizeTeam)
      };
    },

    async getTeam(teamId) {
      const { data, error } = await client
        .from("teams")
        .select()
        .eq("id", teamId)
        .single();

      if (error) throw error;
      return normalizeTeam(data);
    },

    async setSessionStatus({ sessionId, status }) {
      const { data, error } = await client
        .from("game_sessions")
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) throw error;
      return normalizeSession(data);
    },

    async saveTeamState({ teamId, expectedVersion, state }) {
      const { data, error } = await client
        .from("teams")
        .update({
          state,
          state_version: expectedVersion + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", teamId)
        .eq("state_version", expectedVersion)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Team state changed; refresh before saving");
      }
      return normalizeTeam(data);
    },

    subscribeToTeam(teamId, onChange) {
      const channel = client
        .channel(`team:${teamId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "teams", filter: `id=eq.${teamId}` },
          (payload) => onChange(normalizeTeam(payload.new))
        )
        .subscribe();

      return () => client.removeChannel(channel);
    }
  };
}
