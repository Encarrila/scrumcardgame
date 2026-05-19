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

function completeStory(state, catalog, storyId = 1) {
  state = selectStoryForTurn(state, { participantId: state.activeParticipantId, storyId });
  state = rollDiceForSelectedStory(state, { participantId: state.activeParticipantId, dice: [3, 4] });
  return applyCardToState(state, {
    participantId: state.activeParticipantId,
    card: { ...catalog.events[3], cardType: "evento" },
    targetStoryId: storyId
  });
}

function completeTurn(state, catalog, storyId = 2) {
  state = selectStoryForTurn(state, { participantId: state.activeParticipantId, storyId });
  state = rollDiceForSelectedStory(state, { participantId: state.activeParticipantId, dice: [1, 1] });
  return applyCardToState(state, {
    participantId: state.activeParticipantId,
    card: { ...catalog.events[1], cardType: "evento" }
  });
}

describe("game-engine rules", () => {
  test("rejects ending a turn before required actions are complete", () => {
    const { state } = readyState();

    expect(() => endTurn(state, { participantId: "p1" })).toThrow("Turn is incomplete");
    expect(state.activeParticipantId).toBe("p1");
    expect(state.currentDay).toBe(1);
  });

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

    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });
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
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 2 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [1, 1] });
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

  test("rotates participants, advances days, and records sprint history after day 3", () => {
    let { state, catalog } = readyState();
    state = completeStory(state, catalog, 1);

    state = endTurn(state, { participantId: "p1" });
    expect(state.activeParticipantId).toBe("p2");
    expect(state.currentDay).toBe(1);

    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });
    expect(state.activeParticipantId).toBe("p1");
    expect(state.currentDay).toBe(2);

    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });
    expect(state.currentDay).toBe(3);
    expect(state.currentSprint).toBe(1);

    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });

    expect(state.currentDay).toBe(1);
    expect(state.currentSprint).toBe(2);
    expect(state.sprintHistory).toHaveLength(1);
    expect(state.sprintHistory[0]).toMatchObject({
      sprint: 1,
      committedStoryIds: [1, 2],
      doneStoryIds: [1],
      points: 18
    });
  });

  test("removes completed counts when a DONE story receives added hours", () => {
    let { state, catalog } = readyState();
    state = completeStory(state, catalog, 1);
    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });

    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.events[2], cardType: "evento" },
      targetStoryId: 1
    });

    expect(state.backlog[0].status).toBe("doing");
    expect(state.completedStoryIds).not.toContain(1);
    expect(state.totalPoints).toBe(0);
  });

  test("removes completed counts when a DONE story is reset", () => {
    let { state, catalog } = readyState();
    state = completeStory(state, catalog, 1);
    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });

    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.events[5], cardType: "evento" },
      targetStoryId: 1
    });

    expect(state.backlog[0].status).toBe("doing");
    expect(state.completedStoryIds).not.toContain(1);
    expect(state.totalPoints).toBe(0);
  });

  test("removes completed counts when a DONE story receives a problem and counts it again after solution", () => {
    let { state, catalog } = readyState();
    state = completeStory(state, catalog, 1);
    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });

    state = selectStoryForTurn(state, { participantId: "p1", storyId: 3 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [1, 1] });
    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.problems[0], cardType: "problema" },
      targetStoryId: 1
    });

    expect(state.backlog[0].status).toBe("doing");
    expect(state.completedStoryIds).not.toContain(1);
    expect(state.totalPoints).toBe(0);

    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 3 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [1, 1] });
    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.solutions[0], cardType: "solucion" },
      targetStoryId: 1
    });

    expect(state.backlog[0].status).toBe("done");
    expect(state.completedStoryIds).toContain(1);
    expect(state.totalPoints).toBe(18);
  });

  test("rejects invalid dice payloads", () => {
    let { state } = readyState();
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 1 });

    for (const dice of [[1], [1, 2, 3], [0, 4], [3, 7], [2.5, 3], ["2", 3]]) {
      expect(() =>
        rollDiceForSelectedStory(state, { participantId: "p1", dice })
      ).toThrow("Dice must be exactly two integers from 1 to 6");
    }
  });

  test("prevents selecting a different story after dice are rolled", () => {
    let { state } = readyState();
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 1 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [1, 1] });

    expect(() =>
      selectStoryForTurn(state, { participantId: "p1", storyId: 2 })
    ).toThrow("Cannot select another story after dice are rolled");
  });

  test("prevents applying more than one non-DRAW_AGAIN card per turn", () => {
    let { state, catalog } = readyState();
    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.events[0], cardType: "evento" }
    });

    expect(() =>
      applyCardToState(state, {
        participantId: "p1",
        card: { ...catalog.events[2], cardType: "evento" },
        targetStoryId: 1
      })
    ).toThrow("Card was already drawn this turn");
  });

  test("allows DRAW_AGAIN to be followed by another card in the same turn", () => {
    let { state, catalog } = readyState();
    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.events[7], cardType: "evento" }
    });
    state = applyCardToState(state, {
      participantId: "p1",
      card: { ...catalog.events[0], cardType: "evento" }
    });

    expect(state.pendingTeamRollBonus).toBe(4);
  });

  test("clones stored card payloads so caller mutations do not affect state", () => {
    let { state, catalog } = readyState();
    const problem = { ...catalog.problems[0], cardType: "problema" };

    state = selectStoryForTurn(state, { participantId: "p1", storyId: 1 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [1, 1] });
    state = applyCardToState(state, {
      participantId: "p1",
      card: problem,
      targetStoryId: 1
    });
    problem.name = "Mutated problem";

    expect(state.backlog[0].problems[0].name).toBe(catalog.problems[0].name);

    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });
    const solution = { ...catalog.solutions[1], cardType: "solucion" };
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 2 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [1, 1] });
    state = applyCardToState(state, {
      participantId: "p1",
      card: solution
    });
    solution.name = "Mutated solution";

    expect(state.solutions[0].name).toBe(catalog.solutions[1].name);

    state = endTurn(state, { participantId: "p1" });
    state = completeTurn(state, catalog);
    state = endTurn(state, { participantId: "p2" });
    const event = { ...catalog.events[0], cardType: "evento" };
    state = selectStoryForTurn(state, { participantId: "p1", storyId: 2 });
    state = rollDiceForSelectedStory(state, { participantId: "p1", dice: [1, 1] });
    state = applyCardToState(state, {
      participantId: "p1",
      card: event
    });
    event.name = "Mutated event";

    expect(state.discardPile.at(-1).name).toBe(catalog.events[0].name);
  });
});
