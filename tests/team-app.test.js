import { beforeEach, describe, expect, test } from "vitest";
import { createTeamApp } from "../src/team-app.js";

const DB_KEY = "scrum-card-game-db";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    clear() {
      store.clear();
    }
  };
}

function createRoot() {
  const nodes = new Map();
  return {
    _innerHTML: "",
    set innerHTML(value) {
      this._innerHTML = value;
      if (value.includes('id="team-output"')) {
        nodes.set("#team-output", { innerHTML: "" });
      }
      if (value.includes('id="join-team"')) {
        nodes.set("#join-team", {
          clickHandler: null,
          addEventListener(event, handler) {
            if (event === "click") {
              this.clickHandler = handler;
            }
          },
          click() {
            this.clickHandler?.();
          }
        });
      }
      if (value.includes('id="participant-name"')) {
        nodes.set("#participant-name", { value: "" });
      }
    },
    get innerHTML() {
      return this._innerHTML;
    },
    querySelector(selector) {
      return nodes.get(selector) ?? null;
    }
  };
}

function seedTeam(storage, team) {
  storage.setItem(DB_KEY, JSON.stringify({ sessions: [], teams: [team] }));
}

function teamFixture(overrides = {}) {
  return {
    id: "team-1",
    name: "Equipo <script>",
    stateVersion: 0,
    state: {
      participants: [
        { id: "p1", displayName: "Ana <img>", turnOrder: 0 },
        { id: "p2", displayName: "Luis & Co", turnOrder: 1 }
      ],
      activeParticipantId: "p1"
    },
    ...overrides
  };
}

describe("team app shell", () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    globalThis.window = {
      location: { search: "?team=team-1" },
      localStorage: storage
    };
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
      randomUUID() {
        return "participant-new";
      }
      }
    });
  });

  test("escapes stored team and participant names before rendering", () => {
    seedTeam(storage, teamFixture());
    const root = createRoot();

    createTeamApp(root);

    const html = root.querySelector("#team-output").innerHTML;
    expect(html).toContain("Equipo &lt;script&gt;");
    expect(html).toContain("Ana &lt;img&gt;");
    expect(html).toContain("Luis &amp; Co");
    expect(html).not.toContain("Equipo <script>");
    expect(html).not.toContain("Ana <img>");
  });

  test("loads team data through the injected sync boundary", () => {
    const root = createRoot();
    const sync = {
      getTeam(teamId) {
        expect(teamId).toBe("team-1");
        return teamFixture({ name: "Equipo sync" });
      },
      saveTeamState() {
        throw new Error("not used");
      }
    };

    createTeamApp(root, { sync });

    expect(root.querySelector("#team-output").innerHTML).toContain("Equipo sync");
    expect(storage.getItem(DB_KEY)).toBe(null);
  });

  test("renders a readable error when local storage is corrupt", () => {
    storage.setItem(DB_KEY, "{bad json");
    const root = createRoot();

    createTeamApp(root);

    expect(root.innerHTML).toContain("No se pudo leer la sala local");
  });

  test("renders a retry message when saving fails because the team changed", () => {
    seedTeam(storage, teamFixture());
    const root = createRoot();
    createTeamApp(root);
    const staleDb = JSON.stringify({ sessions: [], teams: [teamFixture()] });
    const changedDb = JSON.stringify({
      sessions: [],
      teams: [teamFixture({ stateVersion: 1 })]
    });
    let dbReads = 0;
    storage.getItem = (key) => {
      if (key !== DB_KEY) {
        return null;
      }
      dbReads += 1;
      return dbReads === 1 ? staleDb : changedDb;
    };

    root.querySelector("#participant-name").value = "Marta";
    root.querySelector("#join-team").click();

    expect(root.querySelector("#team-output").innerHTML).toContain("actualiza la sala e intenta nuevamente");
  });
});
