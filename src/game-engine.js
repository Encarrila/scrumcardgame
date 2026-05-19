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

function createTurnActions() {
    return {
        selected: false,
        diceRolled: false,
        hoursDeducted: false,
        cardDrawn: false
    };
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

function activeParticipantIndex(state) {
    return state.participants.findIndex((participant) => participant.id === state.activeParticipantId);
}

function markCompleted(next, story) {
    if (!next.completedStoryIds.includes(story.id)) {
        next.completedStoryIds.push(story.id);
        next.totalPoints += story.originalHours;
    }
}

function checkStoryCompletion(next, story) {
    if (story.remainingHours <= 0) {
        story.remainingHours = 0;
        if (story.problems.length === 0) {
            story.status = "done";
            markCompleted(next, story);
        }
    }
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
        turnActions: createTurnActions(),
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
    const next = clone(state);
    next.sessionPaused = paused;
    return next;
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

    const diceTotal = dice.reduce((total, value) => total + value, 0);
    const hourReduction = Math.max(0, diceTotal + next.pendingTeamRollBonus);
    next.pendingTeamRollBonus = 0;
    next.diceResult = hourReduction;
    next.turnActions.diceRolled = true;
    next.turnActions.hoursDeducted = true;

    story.remainingHours = Math.max(0, story.remainingHours - hourReduction);
    checkStoryCompletion(next, story);

    return next;
}

export function applyCardToState(state, { participantId, card, targetStoryId }) {
    assertCanAct(state, participantId);

    const next = clone(state);

    if (card.cardType === "evento") {
        applyEventCard(next, card, targetStoryId);
        next.turnActions.cardDrawn = true;
        return next;
    }

    if (card.cardType === "problema") {
        const story = findStory(next, targetStoryId ?? next.selectedStoryId);
        story.problems.push(card);
        if (story.status === "done") {
            story.status = "doing";
        }
        next.turnActions.cardDrawn = true;
        return next;
    }

    if (card.cardType === "solucion") {
        const stories = targetStoryId ? [findStory(next, targetStoryId)] : next.backlog;

        for (const story of stories) {
            const problemIndex = story.problems.findIndex((problem) => (
                problem.solutionId === card.id || problem.id === card.resolvesId
            ));

            if (problemIndex !== -1) {
                const [problem] = story.problems.splice(problemIndex, 1);
                next.discardPile.push(problem, card);
                checkStoryCompletion(next, story);
                next.turnActions.cardDrawn = true;
                return next;
            }
        }

        next.solutions.push(card);
        next.turnActions.cardDrawn = true;
        return next;
    }

    next.discardPile.push(card);
    next.turnActions.cardDrawn = true;
    return next;
}

function applyEventCard(next, card, targetStoryId) {
    if (card.action === "ADD_NEXT_TEAM_ROLL") {
        next.pendingTeamRollBonus += card.value;
        next.discardPile.push(card);
        return;
    }

    if (card.action === "REDUCE_NEXT_TEAM_ROLL") {
        next.pendingTeamRollBonus -= card.value;
        next.discardPile.push(card);
        return;
    }

    if (card.action === "ADD_HOURS") {
        const story = findStory(next, targetStoryId ?? next.selectedStoryId);
        story.remainingHours += card.value;
        if (story.status === "done") {
            story.status = "doing";
        }
        next.discardPile.push(card);
        return;
    }

    if (card.action === "COMPLETE_STORY") {
        const story = findStory(next, targetStoryId ?? next.selectedStoryId);
        story.remainingHours = 0;
        checkStoryCompletion(next, story);
        next.discardPile.push(card);
        return;
    }

    if (card.action === "RESET_STORY") {
        const story = findStory(next, targetStoryId ?? next.selectedStoryId);
        story.remainingHours = story.originalHours;
        if (story.status === "done") {
            story.status = "doing";
        }
        next.discardPile.push(card);
        return;
    }

    next.discardPile.push(card);
}

export function endTurn(state, { participantId }) {
    assertCanAct(state, participantId);

    const next = clone(state);
    const index = activeParticipantIndex(next);
    const nextIndex = index === -1 ? 0 : (index + 1) % next.participants.length;

    next.activeParticipantId = next.participants[nextIndex]?.id ?? null;
    next.selectedStoryId = null;
    next.diceResult = null;
    next.turnActions = createTurnActions();

    return next;
}
