# Remote Multiteam Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tested game-rule foundation, local multiteam shell, and Supabase-ready sync boundary for the remote Scrum Card Game.

**Architecture:** Extract the current one-file game behavior into a pure `src/game-engine.js` module with deterministic actions and tests. Keep the existing browser UI working while adding a new role-based shell for teacher/team routes and a `sync` interface that starts with local storage and can swap to Supabase.

**Tech Stack:** Vanilla JavaScript ES modules, Vitest for tests, static HTML/CSS, Supabase JavaScript client planned behind `src/sync/sync-service.js`.

---

## Scope

This plan implements the first deployable foundation. It does not complete every polished UI detail from the design spec, but it creates the core modules, tests the rules, and adds a local multiteam prototype path that can later be wired to Supabase without rewriting the game rules.

## File Structure

- Create `package.json`: npm scripts and dev dependencies.
- Create `src/catalog.js`: edition card/story catalog as ES module.
- Create `src/game-engine.js`: pure state transitions and validation.
- Create `src/sync/local-sync-service.js`: local storage implementation of the sync boundary.
- Create `src/sync/supabase-sync-service.js`: Supabase-shaped implementation stub with explicit exported API and runtime guard.
- Create `src/app-router.js`: route detection for teacher/team/local legacy modes.
- Create `src/teacher-app.js`: first teacher dashboard shell using local sync.
- Create `src/team-app.js`: first team room shell using local sync and engine.
- Create `tests/game-engine.test.js`: rule and bug regression tests.
- Create `tests/local-sync-service.test.js`: sync contract tests using local storage mock.
- Modify `index.html`: load ES module router and add route containers while preserving legacy fallback.
- Modify `styles.css`: add teacher/team shell styles.
- Modify `game.js`: expose legacy mode only when the legacy screen exists and router asks for it.

## Task 1: Add Test Tooling

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create npm project config**

Create `package.json` with this exact content:

```json
{
  "name": "scrum-card-game",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "serve": "vite --host 127.0.0.1"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules` and `package-lock.json` are created.

- [ ] **Step 3: Verify test command currently has no tests**

Run:

```bash
npm test
```

Expected: Vitest runs and reports no test files or exits with a no-tests message. This is acceptable before Task 2.

- [ ] **Step 4: Commit**

Run:

```bash
git add package.json package-lock.json
git commit -m "chore: add test tooling"
```

## Task 2: Move Catalog Data Into an ES Module

**Files:**
- Create: `src/catalog.js`
- Modify: `game-data.js`

- [ ] **Step 1: Create the catalog module**

Create `src/catalog.js` by copying the current `HISTORIAS`, `EVENTOS`, `PROBLEMAS`, and `SOLUCIONES` arrays from `game-data.js`, then export them:

```js
export const HISTORIAS = [
  { id: 1, description: "Como empleado, quiero actualizar mis datos personales en el sistema de manera autonoma", hours: 18 },
  { id: 2, description: "Como reclutador, quiero publicar vacantes en multiples portales automaticamente", hours: 24 },
  { id: 3, description: "Como gerente, quiero evaluar el desempeno de mi equipo digitalmente", hours: 32 },
  { id: 4, description: "Como empleado, quiero solicitar vacaciones a traves del sistema", hours: 15 },
  { id: 5, description: "Como RRHH, quiero generar reportes de rotacion de personal", hours: 28 },
  { id: 6, description: "Como candidato, quiero aplicar a posiciones y hacer seguimiento del proceso", hours: 21 },
  { id: 7, description: "Como RRHH, quiero gestionar el proceso de onboarding digital", hours: 36 },
  { id: 8, description: "Como empleado, quiero inscribirme a capacitaciones disponibles", hours: 19 },
  { id: 9, description: "Como RRHH, quiero implementar encuestas de clima organizacional", hours: 42 },
  { id: 10, description: "Como gerente, quiero aprobar solicitudes de mi equipo", hours: 26 },
  { id: 11, description: "Como RRHH, quiero integrar el sistema con nomina", hours: 31 },
  { id: 12, description: "Como empleado, quiero ver mi trayectoria de desarrollo profesional", hours: 23 },
  { id: 13, description: "Como RRHH, quiero automatizar el calculo de beneficios", hours: 38 },
  { id: 14, description: "Como empleado, quiero reportar reconocimientos a colegas", hours: 17 },
  { id: 15, description: "Como RRHH, quiero gestionar planes de sucesion", hours: 29 },
  { id: 16, description: "Como RRHH, quiero implementar evaluaciones 360 grados", hours: 34 }
];

export const EVENTOS = [
  { id: 1, name: "Apoyo de la Direccion", effect: "Adiciona 4 puntos a la proxima tirada del equipo", type: "positive", action: "ADD_NEXT_TEAM_ROLL", value: 4 },
  { id: 2, name: "Auditoria Laboral", effect: "Salta tu siguiente turno", type: "negative", action: "SKIP_TURN", value: 1 },
  { id: 3, name: "Cambio en Normativa", effect: "Esta historia tomara 6 horas mas", type: "negative", action: "ADD_HOURS", value: 6 },
  { id: 4, name: "Consultor Externo Disponible", effect: "Una historia en progreso se termina instantaneamente", type: "positive", action: "COMPLETE_STORY", value: 1 },
  { id: 5, name: "Reunion Sindical Urgente", effect: "Todo el equipo salta el siguiente turno", type: "negative", action: "SKIP_TEAM_TURN", value: 1 },
  { id: 6, name: "Caida del Sistema HRIS", effect: "Remueve todo progreso de una historia en progreso", type: "negative", action: "RESET_STORY", value: 1 },
  { id: 7, name: "Celebracion de Aniversario", effect: "Resta 2 puntos del resultado de todo mundo", type: "negative", action: "REDUCE_NEXT_TEAM_ROLL", value: 2 },
  { id: 8, name: "Presupuesto Extra Aprobado", effect: "Toma otra carta y sigue sus instrucciones", type: "positive", action: "DRAW_AGAIN", value: 1 }
];

export const PROBLEMAS = [
  { id: 1, name: "Normativa Laboral Ambigua", effect: "La especificacion legal no esta suficientemente clara", solutionId: 1 },
  { id: 2, name: "Resistencia al Cambio", effect: "Los usuarios se niegan a adoptar la nueva funcionalidad", solutionId: 2 },
  { id: 3, name: "Conflicto de Privacidad", effect: "Problema detectado con datos personales sensibles", solutionId: 6 },
  { id: 4, name: "Revision Legal Pendiente", effect: "El area legal debe aprobar antes de continuar", solutionId: 3 },
  { id: 5, name: "Informacion Sindical Faltante", effect: "No puedes proceder sin consulta sindical", solutionId: 4 },
  { id: 6, name: "Incompatibilidad de Sistemas", effect: "El sistema legacy bloquea la integracion", solutionId: 5 },
  { id: 7, name: "Falta de Presupuesto", effect: "No hay fondos disponibles para completar esta funcionalidad", solutionId: 7 },
  { id: 8, name: "Conflicto entre Areas", effect: "Diferentes departamentos no logran ponerse de acuerdo", solutionId: 8 }
];

export const SOLUCIONES = [
  { id: 1, name: "Asesoria en Compliance", effect: "Resuelve problemas de normativa laboral ambigua", resolvesId: 1 },
  { id: 2, name: "Workshop de Gestion del Cambio", effect: "Resuelve la resistencia de usuarios", resolvesId: 2 },
  { id: 3, name: "Consultoria Legal Express", effect: "Resuelve bloqueos por revision legal pendiente", resolvesId: 4 },
  { id: 4, name: "Mesa de Dialogo Sindical", effect: "Resuelve falta de informacion sindical", resolvesId: 5 },
  { id: 5, name: "Especialista en Integracion", effect: "Resuelve incompatibilidades de sistemas", resolvesId: 6 },
  { id: 6, name: "Oficina de Proteccion de Datos", effect: "Resuelve conflictos de privacidad", resolvesId: 3 },
  { id: 7, name: "Aprobacion de Presupuesto Extraordinario", effect: "Resuelve falta de presupuesto", resolvesId: 7 },
  { id: 8, name: "Facilitador de Consenso", effect: "Resuelve conflictos entre areas", resolvesId: 8 }
];

export function createCatalog() {
  return {
    stories: HISTORIAS,
    events: EVENTOS,
    problems: PROBLEMAS,
    solutions: SOLUCIONES
  };
}
```

- [ ] **Step 2: Keep legacy globals compatible**

Replace the top of `game-data.js` with the same arrays and leave the existing global functions in place for the legacy UI. The only required behavior change is that event `id: 1` uses action `ADD_NEXT_TEAM_ROLL` and text says "proxima tirada del equipo".

- [ ] **Step 3: Run the existing app manually**

Open `index.html` directly or through `npm run serve`. Expected: the original configuration screen still loads and `Comenzar Juego` still starts a one-team game.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/catalog.js game-data.js
git commit -m "refactor: extract game catalog"
```

## Task 3: Write Failing Game Engine Rule Tests

**Files:**
- Create: `tests/game-engine.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/game-engine.test.js`:

```js
import { describe, expect, test } from "vitest";
import {
  applyCardToState,
  createInitialTeamState,
  endTurn,
  joinParticipant,
  rollDiceForSelectedStory,
  selectStoryForTurn,
  setSessionPaused
} from "../src/game-engine.js";
import { createCatalog } from "../src/catalog.js";

function readyState() {
  const catalog = createCatalog();
  let state = createInitialTeamState({ teamName: "Equipo A", totalSprints: 2, catalog });
  state = joinParticipant(state, { participantId: "p1", displayName: "Ana" });
  state = joinParticipant(state, { participantId: "p2", displayName: "Luis" });
  return { state, catalog };
}

describe("game-engine rules", () => {
  test("rejects rolling dice when the selected story has zero remaining hours", () => {
    let { state } = readyState();
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 1 });
    state.backlog[0].remainingHours = 0;

    expect(() =>
      rollDiceForSelectedStory(state, { participantId: "p1", dice: [3, 4] })
    ).toThrow("Cannot roll dice for a story with zero remaining hours");
  });

  test("keeps zero-hour blocked stories out of DONE until matching solution is applied", () => {
    let { state, catalog } = readyState();
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 1 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [6, 6] });
    state.backlog[0].remainingHours = 0;
    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.problems[0], cardType: "problema" },
      targetStoryId: 1
    });

    expect(state.backlog[0].status).toBe("doing");
    expect(state.backlog[0].problems).toHaveLength(1);

    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.solutions[0], cardType: "solucion" },
      targetStoryId: 1
    });

    expect(state.backlog[0].status).toBe("done");
  });

  test("allows blocked stories with remaining hours to keep receiving hour reductions", () => {
    let { state, catalog } = readyState();
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 1 });
    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.problems[0], cardType: "problema" },
      targetStoryId: 1
    });

    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [2, 3] });

    expect(state.backlog[0].remainingHours).toBe(13);
    expect(state.backlog[0].status).toBe("doing");
  });

  test("+4 next roll card does not change current story immediately", () => {
    let { state, catalog } = readyState();
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 1 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [2, 3] });
    const remainingAfterRoll = state.backlog[0].remainingHours;

    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.events[0], cardType: "evento" }
    });

    expect(state.backlog[0].remainingHours).toBe(remainingAfterRoll);
    expect(state.pendingTeamRollBonus).toBe(4);
  });

  test("+4 next roll applies to the next team participant and is consumed once", () => {
    let { state, catalog } = readyState();
    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.events[0], cardType: "evento" }
    });
    state = endTurn(state, { participantId: "p1" });
    state = selectStoryForTurn(state, { participantId: "p2", storyId: 1 });
    state = rollDiceForSelectedStory(state, { participantId: "p2", dice: [1, 1] });

    expect(state.backlog[0].remainingHours).toBe(12);
    expect(state.pendingTeamRollBonus).toBe(0);
  });

  test("rejects actions from non-active participants", () => {
    let { state } = readyState();

    expect(() =>
      selectStoryForTurn(state, { participantId: "p2", storyId: 1 })
    ).toThrow("Only the active participant can act");
  });

  test("rejects team actions while session is paused", () => {
    let { state } = readyState();
    state = setSessionPaused(state, true);

    expect(() =>
      selectStoryForTurn(state, { participantId: "p1", storyId: 1 })
    ).toThrow("Session is paused");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- tests/game-engine.test.js
```

Expected: FAIL because `src/game-engine.js` does not exist.

- [ ] **Step 3: Commit tests**

Run:

```bash
git add tests/game-engine.test.js
git commit -m "test: capture game engine rule requirements"
```

## Task 4: Implement Pure Game Engine

**Files:**
- Create: `src/game-engine.js`

- [ ] **Step 1: Create the engine implementation**

Create `src/game-engine.js`:

```js
function clone(value) {
  return structuredClone(value);
}

function createBacklog(stories) {
  return stories.map((story) => ({
    ...story,
    originalHours: story.hours,
    remainingHours: story.hours,
    problems: [],
    inSprint: false,
    status: "backlog"
  }));
}

function assertCanAct(state, participantId) {
  if (state.sessionPaused) {
    throw new Error("Session is paused");
  }
  if (!state.activeParticipantId || state.activeParticipantId !== participantId) {
    throw new Error("Only the active participant can act");
  }
}

function findStory(state, storyId) {
  const story = state.backlog.find((candidate) => candidate.id === storyId);
  if (!story) {
    throw new Error(`Story ${storyId} was not found`);
  }
  return story;
}

function checkStoryCompletion(story) {
  if (story.remainingHours <= 0 && story.problems.length === 0) {
    story.remainingHours = 0;
    story.status = "done";
  }
}

function activeParticipantIndex(state) {
  return state.participants.findIndex((participant) => participant.id === state.activeParticipantId);
}

export function createInitialTeamState({ teamName, totalSprints, catalog }) {
  return {
    teamName,
    totalSprints,
    currentSprint: 1,
    currentDay: 1,
    sessionPaused: false,
    participants: [],
    activeParticipantId: null,
    backlog: createBacklog(catalog.stories),
    opportunityDeck: [],
    discardPile: [],
    selectedStoryId: null,
    diceResult: null,
    pendingTeamRollBonus: 0,
    turnActions: {
      selected: false,
      diceRolled: false,
      hoursDeducted: false,
      cardDrawn: false
    },
    solutions: [],
    completedStoryIds: [],
    totalPoints: 0,
    sprintHistory: []
  };
}

export function joinParticipant(state, { participantId, displayName }) {
  const next = clone(state);
  if (next.participants.some((participant) => participant.id === participantId)) {
    return next;
  }
  next.participants.push({
    id: participantId,
    displayName,
    turnOrder: next.participants.length
  });
  if (!next.activeParticipantId) {
    next.activeParticipantId = participantId;
  }
  return next;
}

export function setSessionPaused(state, paused) {
  return {
    ...clone(state),
    sessionPaused: paused
  };
}

export function selectStoryForTurn(state, { participantId, storyId }) {
  assertCanAct(state, participantId);
  const next = clone(state);
  const story = findStory(next, storyId);
  if (story.status === "done") {
    throw new Error("Cannot select a DONE story");
  }
  if (story.remainingHours <= 0) {
    throw new Error("Cannot select a story with zero remaining hours");
  }
  story.inSprint = true;
  if (story.status === "backlog" || story.status === "todo") {
    story.status = "doing";
  }
  next.selectedStoryId = storyId;
  next.turnActions.selected = true;
  return next;
}

export function rollDiceForSelectedStory(state, { participantId, dice }) {
  assertCanAct(state, participantId);
  if (!state.selectedStoryId) {
    throw new Error("Select a story before rolling dice");
  }
  if (state.turnActions.diceRolled) {
    throw new Error("Dice were already rolled this turn");
  }
  const next = clone(state);
  const story = findStory(next, next.selectedStoryId);
  if (story.remainingHours <= 0) {
    throw new Error("Cannot roll dice for a story with zero remaining hours");
  }
  const diceTotal = dice[0] + dice[1];
  const total = Math.max(0, diceTotal + next.pendingTeamRollBonus);
  next.pendingTeamRollBonus = 0;
  next.diceResult = total;
  story.remainingHours = Math.max(0, story.remainingHours - total);
  next.turnActions.diceRolled = true;
  next.turnActions.hoursDeducted = true;
  checkStoryCompletion(story);
  if (story.status === "done" && !next.completedStoryIds.includes(story.id)) {
    next.completedStoryIds.push(story.id);
    next.totalPoints += story.originalHours;
  }
  return next;
}

export function applyCardToState(state, { participantId, card, targetStoryId }) {
  assertCanAct(state, participantId);
  const next = clone(state);

  if (card.cardType === "evento") {
    if (card.action === "ADD_NEXT_TEAM_ROLL") {
      next.pendingTeamRollBonus += card.value;
      next.discardPile.push(card);
    } else if (card.action === "REDUCE_NEXT_TEAM_ROLL") {
      next.pendingTeamRollBonus -= card.value;
      next.discardPile.push(card);
    } else if (card.action === "ADD_HOURS") {
      const story = findStory(next, targetStoryId);
      story.remainingHours += card.value;
      if (story.status === "done") {
        story.status = "doing";
      }
      next.discardPile.push(card);
    } else if (card.action === "COMPLETE_STORY") {
      const story = findStory(next, targetStoryId);
      story.remainingHours = 0;
      checkStoryCompletion(story);
      next.discardPile.push(card);
    } else if (card.action === "RESET_STORY") {
      const story = findStory(next, targetStoryId);
      story.remainingHours = story.originalHours;
      if (story.status === "done") {
        story.status = "doing";
      }
      next.discardPile.push(card);
    } else {
      next.discardPile.push(card);
    }
    return next;
  }

  if (card.cardType === "problema") {
    const story = findStory(next, targetStoryId ?? next.selectedStoryId);
    story.problems.push(card);
    if (story.status === "done") {
      story.status = "doing";
    }
    return next;
  }

  if (card.cardType === "solucion") {
    const stories = targetStoryId ? [findStory(next, targetStoryId)] : next.backlog;
    for (const story of stories) {
      const problemIndex = story.problems.findIndex((problem) => problem.solutionId === card.id);
      if (problemIndex !== -1) {
        const [problem] = story.problems.splice(problemIndex, 1);
        next.discardPile.push(problem, card);
        checkStoryCompletion(story);
        if (story.status === "done" && !next.completedStoryIds.includes(story.id)) {
          next.completedStoryIds.push(story.id);
          next.totalPoints += story.originalHours;
        }
        return next;
      }
    }
    next.solutions.push(card);
    return next;
  }

  throw new Error(`Unsupported card type: ${card.cardType}`);
}

export function endTurn(state, { participantId }) {
  assertCanAct(state, participantId);
  const next = clone(state);
  const currentIndex = activeParticipantIndex(next);
  if (currentIndex === -1 || next.participants.length === 0) {
    throw new Error("No active participant found");
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= next.participants.length) {
    next.activeParticipantId = next.participants[0].id;
    next.currentDay += 1;
  } else {
    next.activeParticipantId = next.participants[nextIndex].id;
  }

  if (next.currentDay > 3) {
    const committed = next.backlog.filter((story) => story.inSprint);
    const done = committed.filter((story) => story.status === "done");
    next.sprintHistory.push({
      sprint: next.currentSprint,
      committed: committed.length,
      done: done.length,
      points: done.reduce((sum, story) => sum + story.originalHours, 0)
    });
    next.currentSprint += 1;
    next.currentDay = 1;
  }

  next.selectedStoryId = null;
  next.diceResult = null;
  next.turnActions = {
    selected: false,
    diceRolled: false,
    hoursDeducted: false,
    cardDrawn: false
  };
  return next;
}
```

- [ ] **Step 2: Run tests and verify GREEN**

Run:

```bash
npm test -- tests/game-engine.test.js
```

Expected: all tests in `tests/game-engine.test.js` pass.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/game-engine.js
git commit -m "feat: add tested game engine"
```

## Task 5: Add Local Sync Contract

**Files:**
- Create: `tests/local-sync-service.test.js`
- Create: `src/sync/local-sync-service.js`

- [ ] **Step 1: Write failing local sync tests**

Create `tests/local-sync-service.test.js`:

```js
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createLocalSyncService
} from "../src/sync/local-sync-service.js";

function makeStorage() {
  const data = new Map();
  return {
    getItem: vi.fn((key) => data.get(key) ?? null),
    setItem: vi.fn((key, value) => data.set(key, value)),
    removeItem: vi.fn((key) => data.delete(key)),
    clear: vi.fn(() => data.clear())
  };
}

describe("local sync service", () => {
  let storage;

  beforeEach(() => {
    storage = makeStorage();
  });

  test("creates a session with teacher code and empty teams", () => {
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

  test("rejects stale team state updates", () => {
    const sync = createLocalSyncService({ storage });
    const session = sync.createSession({ name: "Clase UDESA", totalSprints: 2 });
    const team = sync.createTeam({ sessionId: session.id, name: "Equipo 1" });

    sync.saveTeamState({ teamId: team.id, expectedVersion: 0, state: { currentDay: 1 } });

    expect(() =>
      sync.saveTeamState({ teamId: team.id, expectedVersion: 0, state: { currentDay: 2 } })
    ).toThrow("Team state changed; refresh before saving");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- tests/local-sync-service.test.js
```

Expected: FAIL because `src/sync/local-sync-service.js` does not exist.

- [ ] **Step 3: Implement local sync**

Create `src/sync/local-sync-service.js`:

```js
function randomCode(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function readDb(storage) {
  return JSON.parse(storage.getItem("scrum-card-game-db") ?? '{"sessions":[],"teams":[]}');
}

function writeDb(storage, db) {
  storage.setItem("scrum-card-game-db", JSON.stringify(db));
}

export function createLocalSyncService({ storage = window.localStorage } = {}) {
  return {
    createSession({ name, totalSprints }) {
      const db = readDb(storage);
      const session = {
        id: randomId("session"),
        name,
        totalSprints,
        status: "active",
        teacherCode: randomCode("T"),
        teams: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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

    createTeam({ sessionId, name, initialState = null }) {
      const db = readDb(storage);
      const session = db.sessions.find((candidate) => candidate.id === sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} was not found`);
      }
      const team = {
        id: randomId("team"),
        sessionId,
        name,
        teamCode: randomCode("E"),
        state: initialState,
        stateVersion: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- tests/local-sync-service.test.js
```

Expected: all local sync tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/local-sync-service.test.js src/sync/local-sync-service.js
git commit -m "feat: add local sync service"
```

## Task 6: Add Supabase Sync Boundary

**Files:**
- Create: `src/sync/supabase-sync-service.js`
- Create: `docs/supabase-schema.sql`

- [ ] **Step 1: Create Supabase schema draft**

Create `docs/supabase-schema.sql`:

```sql
create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null check (status in ('draft', 'active', 'paused', 'finished')),
  total_sprints integer not null default 2,
  catalog_version text not null default '2026-rrhh',
  teacher_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  name text not null,
  team_code text not null unique,
  state jsonb,
  state_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  display_name text not null,
  participant_token_hash text not null,
  turn_order integer not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists game_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  participant_id uuid references participants(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Create Supabase sync module**

Create `src/sync/supabase-sync-service.js`:

```js
import { createClient } from "@supabase/supabase-js";

function requireConfig(config) {
  if (!config?.url || !config?.anonKey) {
    throw new Error("Supabase config requires url and anonKey");
  }
}

export function createSupabaseSyncService(config) {
  requireConfig(config);
  const client = createClient(config.url, config.anonKey);

  return {
    async createSession({ name, totalSprints }) {
      const teacherCode = `T-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { data, error } = await client
        .from("game_sessions")
        .insert({
          name,
          total_sprints: totalSprints,
          status: "active",
          teacher_code: teacherCode
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async createTeam({ sessionId, name, initialState = null }) {
      const teamCode = `E-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { data, error } = await client
        .from("teams")
        .insert({
          session_id: sessionId,
          name,
          team_code: teamCode,
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
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm test
```

Expected: all existing tests pass. No Supabase network call is made during tests.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/supabase-schema.sql src/sync/supabase-sync-service.js
git commit -m "feat: add supabase sync boundary"
```

## Task 7: Add Local Teacher and Team Shells

**Files:**
- Create: `src/app-router.js`
- Create: `src/teacher-app.js`
- Create: `src/team-app.js`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Add router module**

Create `src/app-router.js`:

```js
import { createTeacherApp } from "./teacher-app.js";
import { createTeamApp } from "./team-app.js";

function getMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") ?? "legacy";
}

document.addEventListener("DOMContentLoaded", () => {
  const mode = getMode();
  const root = document.getElementById("remote-app");

  if (mode === "teacher") {
    document.getElementById("app")?.classList.add("hidden");
    root.classList.remove("hidden");
    createTeacherApp(root);
  }

  if (mode === "team") {
    document.getElementById("app")?.classList.add("hidden");
    root.classList.remove("hidden");
    createTeamApp(root);
  }
});
```

- [ ] **Step 2: Add teacher shell**

Create `src/teacher-app.js`:

```js
import { createCatalog } from "./catalog.js";
import { createInitialTeamState } from "./game-engine.js";
import { createLocalSyncService } from "./sync/local-sync-service.js";

export function createTeacherApp(root) {
  const sync = createLocalSyncService();
  root.innerHTML = `
    <main class="remote-page">
      <header class="remote-header">
        <div>
          <h1>Scrum Card Game</h1>
          <p>Panel docente</p>
        </div>
      </header>
      <section class="remote-panel">
        <label>Nombre de la sesion</label>
        <input id="session-name" class="text-input" value="Clase Scrum Card Game">
        <label>Cantidad de sprints</label>
        <input id="session-sprints" class="text-input" type="number" min="1" max="5" value="2">
        <button id="create-session" class="btn-primary">Crear sesion local</button>
      </section>
      <section id="teacher-output" class="remote-grid"></section>
    </main>
  `;

  root.querySelector("#create-session").addEventListener("click", () => {
    const session = sync.createSession({
      name: root.querySelector("#session-name").value,
      totalSprints: Number(root.querySelector("#session-sprints").value)
    });
    const catalog = createCatalog();
    const teams = ["Equipo 1", "Equipo 2", "Equipo 3"].map((name) =>
      sync.createTeam({
        sessionId: session.id,
        name,
        initialState: createInitialTeamState({ teamName: name, totalSprints: session.totalSprints, catalog })
      })
    );
    root.querySelector("#teacher-output").innerHTML = teams.map((team) => `
      <article class="team-summary">
        <h2>${team.name}</h2>
        <p>Codigo: <strong>${team.teamCode}</strong></p>
        <a href="?mode=team&session=${session.id}&team=${team.id}">Abrir sala del equipo</a>
      </article>
    `).join("");
  });
}
```

- [ ] **Step 3: Add team shell**

Create `src/team-app.js`:

```js
import { joinParticipant } from "./game-engine.js";
import { createLocalSyncService } from "./sync/local-sync-service.js";

function participantToken() {
  const key = "scrum-card-game-participant-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

export function createTeamApp(root) {
  const params = new URLSearchParams(window.location.search);
  const teamId = params.get("team");
  const sync = createLocalSyncService();

  root.innerHTML = `
    <main class="remote-page">
      <header class="remote-header">
        <div>
          <h1>Sala de equipo</h1>
          <p>Ingreso remoto por nombre</p>
        </div>
      </header>
      <section class="remote-panel">
        <label>Tu nombre</label>
        <input id="participant-name" class="text-input" placeholder="Nombre">
        <button id="join-team" class="btn-primary">Entrar</button>
      </section>
      <section id="team-output" class="remote-panel"></section>
    </main>
  `;

  root.querySelector("#join-team").addEventListener("click", () => {
    const db = JSON.parse(window.localStorage.getItem("scrum-card-game-db"));
    const team = db.teams.find((candidate) => candidate.id === teamId);
    const participantId = participantToken();
    const nextState = joinParticipant(team.state, {
      participantId,
      displayName: root.querySelector("#participant-name").value || "Participante"
    });
    const saved = sync.saveTeamState({
      teamId,
      expectedVersion: team.stateVersion,
      state: nextState
    });
    const active = saved.state.participants.find((participant) => participant.id === saved.state.activeParticipantId);
    root.querySelector("#team-output").innerHTML = `
      <h2>${saved.name}</h2>
      <p>Participantes: ${saved.state.participants.map((participant) => participant.displayName).join(", ")}</p>
      <p>Turno activo: <strong>${active?.displayName ?? "Sin participante activo"}</strong></p>
    `;
  });
}
```

- [ ] **Step 4: Update HTML**

In `index.html`, add this after `<body>`:

```html
    <div id="remote-app" class="hidden"></div>
```

Add this before `</body>` after the legacy scripts:

```html
    <script type="module" src="src/app-router.js"></script>
```

- [ ] **Step 5: Add shell styles**

Append to `styles.css`:

```css
.hidden {
    display: none !important;
}

.remote-page {
    min-height: 100vh;
    background: #eef2f6;
    color: var(--text-primary);
}

.remote-header {
    background: #ffffff;
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 1.5rem;
}

.remote-header h1 {
    color: var(--primary-color);
    font-size: 1.5rem;
}

.remote-header p {
    color: var(--text-secondary);
    margin-top: 0.25rem;
}

.remote-panel {
    background: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin: 1rem;
    padding: 1rem;
}

.remote-panel label {
    display: block;
    font-weight: 600;
    margin: 0.75rem 0 0.35rem;
}

.remote-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    padding: 1rem;
}

.team-summary {
    background: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
}

.team-summary h2 {
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}
```

- [ ] **Step 6: Manual browser verification**

Run:

```bash
npm run serve
```

Open `http://127.0.0.1:5173/?mode=teacher`.

Expected:

- Teacher shell appears.
- Creating a session shows three team cards and links.
- Opening a team link lets a participant enter a name.
- Joining shows participant list and active participant.
- Opening `http://127.0.0.1:5173/` still shows the legacy game.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/app-router.js src/teacher-app.js src/team-app.js index.html styles.css
git commit -m "feat: add local remote-play shells"
```

## Task 8: Integrate Engine Bug Fix Into Legacy Game

**Files:**
- Modify: `game.js`
- Modify: `game-data.js`

- [ ] **Step 1: Fix legacy event action name**

In `game-data.js`, ensure the first event is:

```js
{
    id: 1,
    name: "Apoyo de la Direccion",
    effect: "Adiciona 4 puntos a la proxima tirada del equipo",
    type: "positive",
    action: "ADD_NEXT_TEAM_ROLL",
    value: 4
}
```

- [ ] **Step 2: Fix legacy card effect**

In `game.js`, replace the `case 'ADD_DICE':` block with:

```js
            case 'ADD_NEXT_TEAM_ROLL':
                gameState.bonusDice += card.value;
                gameState.discardPile.push(card);
                break;
```

Remove the immediate subtraction from `selectedStory.remainingHours`.

- [ ] **Step 3: Prevent legacy dice rolls on zero-hour stories**

In `rollDice()`, after checking `selectedStory`, add:

```js
    if (gameState.selectedStory.remainingHours <= 0) {
        alert('Esta historia ya tiene 0 horas restantes. Debes elegir otra historia o aplicar una solucion si esta bloqueada.');
        return;
    }
```

- [ ] **Step 4: Add event cards to rules modal**

In `showRules()` or the static rules modal markup, add an explicit note that events can be consulted from the card reference in the remote shell and include the event list for the legacy view.

- [ ] **Step 5: Manual verification**

Open the legacy app and verify:

- Selecting a 0h story and clicking dice shows the alert.
- Drawing `Apoyo de la Direccion` after a roll does not immediately reduce current story hours.
- The next dice roll uses the stored bonus.

- [ ] **Step 6: Run automated tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add game.js game-data.js
git commit -m "fix: align legacy rules with tested engine"
```

## Task 9: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: all tests pass with no unhandled errors.

- [ ] **Step 2: Run dev server**

Run:

```bash
npm run serve
```

Expected: Vite starts and prints a local URL.

- [ ] **Step 3: Verify three entry points**

Open:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/?mode=teacher
http://127.0.0.1:5173/?mode=team
```

Expected:

- `/` shows the legacy single-team game.
- `?mode=teacher` shows the teacher shell.
- `?mode=team` shows the team shell and handles missing team with a readable message after Task 7 follow-up corrections if needed.

- [ ] **Step 4: Commit any verification fixes**

If verification required fixes, commit them:

```bash
git add .
git commit -m "fix: complete remote foundation verification"
```

## Self-Review

Spec coverage:

- Remote multiteam: covered by local teacher/team shells and sync boundary.
- No formal login: covered by local participant token and name entry.
- Active participant permissions: covered by `game-engine` tests and assertions.
- Flexible team membership: covered by `joinParticipant`.
- Pausing: covered in engine; full teacher UI pause button remains for the next plan.
- Restarting: sync and engine reset UI remains for the next plan.
- Editable dataset: covered by `src/catalog.js`.
- Supabase Free direction: covered by schema and sync boundary.
- Tests: covered by Vitest and required engine tests.

Intentional next-plan work:

- Full polished teacher dashboard.
- Complete team board in remote shell.
- Supabase RLS policy hardening.
- Real Supabase configuration UI/env loading.
- Browser automation visual QA.
