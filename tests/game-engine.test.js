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
