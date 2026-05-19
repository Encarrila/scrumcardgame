import { createClient } from "@supabase/supabase-js";

function requireConfig(config) {
  if (!config?.url || !config?.anonKey) {
    throw new Error("Supabase config requires url and anonKey");
  }
}

function randomCode(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
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
      return data;
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
      return data;
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
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error("Team state changed; refresh before saving");
      }
      return data;
    },

    subscribeToTeam(teamId, onChange) {
      const channel = client
        .channel(`team:${teamId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "teams", filter: `id=eq.${teamId}` },
          (payload) => onChange(payload.new)
        )
        .subscribe();

      return () => client.removeChannel(channel);
    }
  };
}
