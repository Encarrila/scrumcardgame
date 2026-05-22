import { createLocalSyncService } from "./local-sync-service.js";
import { createSupabaseSyncService } from "./supabase-sync-service.js";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "https://qfadihlnbzydwoazxbwb.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_O3Yman0LHOFWa6ytp8haJA_xN33kiqi";

export function createConfiguredSyncService() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        return createSupabaseSyncService({
            url: SUPABASE_URL,
            anonKey: SUPABASE_ANON_KEY
        });
    }

    return createLocalSyncService();
}

export function syncModeLabel() {
    return SUPABASE_URL && SUPABASE_ANON_KEY ? "Supabase" : "Local";
}
