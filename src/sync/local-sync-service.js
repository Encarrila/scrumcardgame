const DB_KEY = "scrum-card-game-db";

function randomCode(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function randomUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomId(prefix) {
  return `${prefix}_${randomUuid()}`;
}

function readDb(storage) {
  return JSON.parse(storage.getItem(DB_KEY) ?? '{"sessions":[],"teams":[]}');
}

function writeDb(storage, db) {
  storage.setItem(DB_KEY, JSON.stringify(db));
}

function defaultStorage() {
  if (!globalThis.window?.localStorage && !globalThis.localStorage) {
    throw new Error("Local sync service requires a storage adapter");
  }
  return globalThis.window?.localStorage ?? globalThis.localStorage;
}

export function createLocalSyncService({ storage = defaultStorage() } = {}) {
  return {
    createSession({ name, totalSprints }) {
      const db = readDb(storage);
      const timestamp = new Date().toISOString();
      const session = {
        id: randomId("session"),
        name,
        totalSprints,
        status: "active",
        teacherCode: randomCode("T"),
        teams: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };
      db.sessions.push(session);
      writeDb(storage, db);
      return session;
    },

    getSession(sessionId) {
      const db = readDb(storage);
      const session = db.sessions.find((candidate) => candidate.id === sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} was not found`);
      }
      return {
        ...session,
        teams: db.teams.filter((team) => team.sessionId === sessionId)
      };
    },

    getTeam(teamId) {
      const db = readDb(storage);
      const team = db.teams.find((candidate) => candidate.id === teamId);
      if (!team) {
        throw new Error(`Team ${teamId} was not found`);
      }
      return team;
    },

    createTeam({ sessionId, name, initialState = null }) {
      const db = readDb(storage);
      const session = db.sessions.find((candidate) => candidate.id === sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} was not found`);
      }
      const timestamp = new Date().toISOString();
      const team = {
        id: randomId("team"),
        sessionId,
        name,
        teamCode: randomCode("E"),
        state: initialState,
        stateVersion: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      db.teams.push(team);
      writeDb(storage, db);
      return team;
    },

    saveTeamState({ teamId, expectedVersion, state }) {
      const db = readDb(storage);
      const team = db.teams.find((candidate) => candidate.id === teamId);
      if (!team) {
        throw new Error(`Team ${teamId} was not found`);
      }
      if (team.stateVersion !== expectedVersion) {
        throw new Error("Team state changed; refresh before saving");
      }
      team.state = state;
      team.stateVersion += 1;
      team.updatedAt = new Date().toISOString();
      writeDb(storage, db);
      return team;
    }
  };
}
