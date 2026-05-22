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
    if (state.gameStatus === "finished") {
        throw new Error("Game is finished");
    }

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

function unmarkCompleted(next, story) {
    if (next.completedStoryIds.includes(story.id)) {
        next.completedStoryIds = next.completedStoryIds.filter((storyId) => storyId !== story.id);
        next.totalPoints = Math.max(0, next.totalPoints - story.originalHours);
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

function reopenStory(next, story) {
    if (story.status === "done") {
        story.status = "doing";
    }
    unmarkCompleted(next, story);
}

function validateDice(dice) {
    if (
        !Array.isArray(dice) ||
        dice.length !== 2 ||
        dice.some((value) => !Number.isInteger(value) || value < 1 || value > 6)
    ) {
        throw new Error("Dice must be exactly two integers from 1 to 6");
    }
}

function isDrawAgain(card) {
    return card.cardType === "evento" && card.action === "DRAW_AGAIN";
}

function assertCanDrawCard(state, card) {
    if (state.turnActions.cardDrawn && !isDrawAgain(card)) {
        throw new Error("Card was already drawn this turn");
    }
}

function markCardDrawn(next, card) {
    if (!isDrawAgain(card)) {
        next.turnActions.cardDrawn = true;
    }
}

function createPendingCard(card) {
    return {
        ...clone(card),
        pendingCardId: crypto.randomUUID(),
        implemented: false
    };
}

function createSprintSummary(state) {
    const committedStories = state.backlog.filter((story) => story.inSprint);
    const doneStories = committedStories.filter((story) => story.status === "done");

    return {
        sprint: state.currentSprint,
        committedStoryIds: committedStories.map((story) => story.id),
        doneStoryIds: doneStories.map((story) => story.id),
        points: doneStories.reduce((total, story) => total + story.originalHours, 0)
    };
}

function clearSprintCommitments(next) {
    for (const story of next.backlog) {
        story.inSprint = false;
    }
}

function assertTurnComplete(state) {
    const { selected, diceRolled, hoursDeducted, cardDrawn } = state.turnActions;
    if (!selected || !diceRolled || !hoursDeducted || !cardDrawn) {
        throw new Error("Turn is incomplete");
    }
}

export function createInitialTeamState({ teamName, totalSprints, catalog }) {
    return {
        teamName,
        totalSprints,
        currentSprint: 1,
        currentDay: 1,
        gameStatus: "in_progress",
        sessionPaused: false,
        participants: [],
        activeParticipantId: null,
        backlog: createBacklog(catalog.stories),
        opportunityDeck: [],
        discardPile: [],
        pendingCards: [],
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

    if (state.turnActions.diceRolled) {
        throw new Error("Cannot select another story after dice are rolled");
    }

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
    validateDice(dice);

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
    assertCanDrawCard(state, card);

    const next = clone(state);
    const storedCard = clone(card);
    applyCardEffect(next, storedCard, targetStoryId);
    markCardDrawn(next, storedCard);
    return next;
}

function applyCardEffect(next, storedCard, targetStoryId) {
    if (storedCard.cardType === "evento") {
        applyEventCard(next, storedCard, targetStoryId);
        return next;
    }

    if (storedCard.cardType === "problema") {
        const story = findStory(next, targetStoryId ?? next.selectedStoryId);
        story.problems.push(storedCard);
        reopenStory(next, story);
        return next;
    }

    if (storedCard.cardType === "solucion") {
        const stories = targetStoryId ? [findStory(next, targetStoryId)] : next.backlog;

        for (const story of stories) {
            const problemIndex = story.problems.findIndex((problem) => (
                problem.solutionId === storedCard.id || problem.id === storedCard.resolvesId
            ));

            if (problemIndex !== -1) {
                const [problem] = story.problems.splice(problemIndex, 1);
                next.discardPile.push(clone(problem), storedCard);
                checkStoryCompletion(next, story);
                return next;
            }
        }

        next.solutions.push(storedCard);
        return next;
    }

    next.discardPile.push(storedCard);
    return next;
}

export function drawOpportunityCardForTurn(state, { participantId, shuffle = (items) => [...items] }) {
    assertCanAct(state, participantId);
    if (state.turnActions.cardDrawn) {
        throw new Error("Card was already drawn this turn");
    }

    const next = clone(state);
    next.pendingCards = next.pendingCards ?? [];
    next.opportunityDeck = next.opportunityDeck ?? [];
    next.discardPile = next.discardPile ?? [];

    if (next.opportunityDeck.length === 0 && next.discardPile.length > 0) {
        next.opportunityDeck = shuffle(next.discardPile);
        next.discardPile = [];
    }

    if (next.opportunityDeck.length === 0) {
        next.turnActions.cardDrawn = true;
        return next;
    }

    const [card, ...remainingDeck] = next.opportunityDeck;
    next.opportunityDeck = remainingDeck;
    next.pendingCards.push(createPendingCard(card));
    next.turnActions.cardDrawn = true;
    return next;
}

export function applyPendingCard(state, { participantId, pendingCardId, targetStoryId }) {
    assertCanAct(state, participantId);

    const next = clone(state);
    next.pendingCards = next.pendingCards ?? [];
    const pendingIndex = next.pendingCards.findIndex((card) => card.pendingCardId === pendingCardId);

    if (pendingIndex === -1) {
        throw new Error("Pending card was not found");
    }

    const [pendingCard] = next.pendingCards.splice(pendingIndex, 1);
    const { pendingCardId: _pendingCardId, implemented: _implemented, ...card } = pendingCard;
    applyCardEffect(next, card, targetStoryId);
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
        reopenStory(next, story);
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
        reopenStory(next, story);
        next.discardPile.push(card);
        return;
    }

    next.discardPile.push(card);
}

export function endTurn(state, { participantId }) {
    assertCanAct(state, participantId);
    assertTurnComplete(state);

    const next = clone(state);
    const index = activeParticipantIndex(next);
    const nextIndex = index === -1 ? 0 : (index + 1) % next.participants.length;
    const completedDay = next.participants.length > 0 && nextIndex === 0;

    next.activeParticipantId = next.participants[nextIndex]?.id ?? null;
    next.selectedStoryId = null;
    next.diceResult = null;
    next.turnActions = createTurnActions();

    if (completedDay) {
        next.currentDay += 1;
        if (next.currentDay > 3) {
            next.sprintHistory.push(createSprintSummary(next));
            clearSprintCommitments(next);

            if (next.currentSprint >= next.totalSprints) {
                next.gameStatus = "finished";
                next.currentDay = 3;
            } else {
                next.currentSprint += 1;
                next.currentDay = 1;
            }
        }
    }

    return next;
}
