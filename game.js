// Estado del juego - Version Stand-alone (un equipo por instancia)
let gameState = {
    team: {
        name: 'Mi Equipo',
        members: 4,
        solutions: [],
        completedStories: [],
        totalPoints: 0,
        sprintHistory: []
    },
    currentPlayerIndex: 0,
    currentSprint: 1,
    currentDay: 1,
    totalSprints: 2,
    backlog: [],
    opportunityDeck: [],
    discardPile: [],
    selectedStory: null,
    diceResult: null,
    turnActions: {
        selected: false,
        diceRolled: false,
        hoursDeducted: false,
        cardDrawn: false
    },
    skipNextTurn: false,
    bonusDice: 0
};

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    // Nada especial que inicializar
});

function adjustValue(inputId, delta) {
    const input = document.getElementById(inputId);
    const newValue = parseInt(input.value) + delta;
    const min = parseInt(input.min);
    const max = parseInt(input.max);

    if (newValue >= min && newValue <= max) {
        input.value = newValue;
    }
}

function startGame() {
    const teamName = document.getElementById('team-name').value || 'Mi Equipo';
    const members = parseInt(document.getElementById('team-members').value);
    const numSprints = parseInt(document.getElementById('num-sprints').value);

    // Inicializar equipo
    gameState.team = {
        name: teamName,
        members: members,
        solutions: [],
        completedStories: [],
        totalPoints: 0,
        sprintHistory: []
    };

    gameState.totalSprints = numSprints;
    gameState.currentSprint = 1;
    gameState.currentDay = 1;
    gameState.currentPlayerIndex = 0;

    // Inicializar backlog y mazo
    gameState.backlog = createBacklog();
    gameState.opportunityDeck = createOpportunityDeck();
    gameState.discardPile = [];

    // Cambiar pantalla
    document.getElementById('config-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    // Actualizar UI
    updateGameUI();
    resetTurnActions();
}

function updateGameUI() {
    document.getElementById('current-team').textContent = gameState.team.name;
    document.getElementById('current-sprint').textContent = `Sprint ${gameState.currentSprint}`;
    document.getElementById('current-day').textContent = `Dia ${gameState.currentDay}`;
    document.getElementById('current-player').textContent = `Jugador ${gameState.currentPlayerIndex + 1} de ${gameState.team.members}`;

    document.getElementById('backlog-count').textContent = gameState.backlog.filter(s => s.status === 'backlog').length;
    document.getElementById('opportunity-count').textContent = gameState.opportunityDeck.length;

    updateKanbanBoard();
    updateTeamSolutions();
    updateProblemsList();
}

function updateKanbanBoard() {
    const todoCards = document.getElementById('todo-cards');
    const doingCards = document.getElementById('doing-cards');
    const doneCards = document.getElementById('done-cards');

    todoCards.innerHTML = '';
    doingCards.innerHTML = '';
    doneCards.innerHTML = '';

    let todoCount = 0, doingCount = 0, doneCount = 0;

    gameState.backlog.forEach(story => {
        if (!story.inSprint) return;

        const card = createStoryCard(story);

        if (story.status === 'todo') {
            todoCards.appendChild(card);
            todoCount++;
        } else if (story.status === 'doing') {
            doingCards.appendChild(card);
            doingCount++;
        } else if (story.status === 'done') {
            doneCards.appendChild(card);
            doneCount++;
        }
    });

    document.getElementById('todo-count').textContent = todoCount;
    document.getElementById('doing-count').textContent = doingCount;
    document.getElementById('done-count').textContent = doneCount;
}

function createStoryCard(story) {
    const card = document.createElement('div');
    card.className = 'story-card';
    if (story.problems.length > 0) card.classList.add('blocked');
    if (gameState.selectedStory && gameState.selectedStory.id === story.id) {
        card.classList.add('selected');
    }

    card.innerHTML = `
        <div class="story-header">
            <span class="story-id">#${story.id}</span>
            <span class="story-hours ${story.remainingHours <= 0 ? 'zero' : ''}">${story.remainingHours}h</span>
        </div>
        <div class="story-description">${story.description}</div>
        ${story.problems.length > 0 ? `<span class="story-blocked-badge">!</span>` : ''}
    `;

    card.onclick = () => selectStory(story);
    return card;
}

function selectStory(story) {
    if (story.status === 'done') return;
    if (story.status === 'backlog') return;

    gameState.selectedStory = story;

    // Mover a doing si estaba en todo
    if (story.status === 'todo') {
        story.status = 'doing';
    }

    gameState.turnActions.selected = true;
    document.getElementById('action-select').checked = true;

    updateKanbanBoard();
}

function showBacklog() {
    const modal = document.getElementById('backlog-modal');
    const list = document.getElementById('backlog-list');
    list.innerHTML = '';

    gameState.backlog.forEach(story => {
        const card = document.createElement('div');
        card.className = 'backlog-card';
        if (story.inSprint) card.classList.add('in-sprint');

        card.innerHTML = `
            <div class="story-header">
                <span class="story-id">#${story.id}</span>
                <span class="story-hours">${story.hours}h</span>
            </div>
            <div class="story-description">${story.description}</div>
            ${story.inSprint ? '<small style="color: #64748b;">Ya en sprint</small>' : ''}
        `;

        if (!story.inSprint) {
            card.onclick = () => addStoryToSprint(story);
        }

        list.appendChild(card);
    });

    modal.classList.add('active');
}

function addStoryToSprint(story) {
    story.inSprint = true;
    story.status = 'todo';

    closeBacklogModal();
    updateGameUI();
}

function closeBacklogModal() {
    document.getElementById('backlog-modal').classList.remove('active');
}

function rollDice() {
    if (gameState.turnActions.diceRolled) return;

    // Debe seleccionar historia primero
    if (!gameState.selectedStory) {
        alert('Primero debes seleccionar una historia del tablero');
        return;
    }

    if (gameState.selectedStory.remainingHours <= 0) {
        alert('Esta historia ya tiene 0 horas restantes. Debes elegir otra historia o aplicar una solucion si esta bloqueada.');
        return;
    }

    const die1 = document.getElementById('die1');
    const die2 = document.getElementById('die2');

    // Animacion
    die1.classList.add('rolling');
    die2.classList.add('rolling');
    die1.textContent = '?';
    die2.textContent = '?';

    setTimeout(() => {
        const roll1 = Math.floor(Math.random() * 6) + 1;
        const roll2 = Math.floor(Math.random() * 6) + 1;

        die1.classList.remove('rolling');
        die2.classList.remove('rolling');
        die1.textContent = roll1;
        die2.textContent = roll2;

        gameState.diceResult = roll1 + roll2 + gameState.bonusDice;
        gameState.bonusDice = 0;

        document.getElementById('dice-result').textContent = gameState.diceResult;

        gameState.turnActions.diceRolled = true;
        document.getElementById('action-dice').checked = true;

        // Descontar horas automaticamente si hay historia seleccionada
        if (gameState.selectedStory) {
            deductHours();
        }
    }, 500);
}

function deductHours() {
    if (!gameState.selectedStory || !gameState.diceResult) return;
    if (gameState.turnActions.hoursDeducted) return;

    gameState.selectedStory.remainingHours -= gameState.diceResult;
    if (gameState.selectedStory.remainingHours < 0) {
        gameState.selectedStory.remainingHours = 0;
    }

    gameState.turnActions.hoursDeducted = true;
    document.getElementById('action-work').checked = true;

    checkStoryCompletion(gameState.selectedStory);
    updateKanbanBoard();
}

function checkStoryCompletion(story) {
    if (story.remainingHours <= 0 && story.problems.length === 0) {
        story.status = 'done';
        if (!gameState.team.completedStories.includes(story.id)) {
            gameState.team.completedStories.push(story.id);
            gameState.team.totalPoints += story.originalHours;
        }
    }
}

function drawOpportunityCard() {
    if (gameState.turnActions.cardDrawn) return;
    if (gameState.opportunityDeck.length === 0) {
        gameState.opportunityDeck = shuffleArray(gameState.discardPile);
        gameState.discardPile = [];
    }

    if (gameState.opportunityDeck.length === 0) {
        alert('No hay mas cartas de oportunidad');
        gameState.turnActions.cardDrawn = true;
        document.getElementById('action-card').checked = true;
        checkEndTurnEnabled();
        return;
    }

    const card = gameState.opportunityDeck.pop();
    showCard(card);

    gameState.turnActions.cardDrawn = true;
    document.getElementById('action-card').checked = true;

    updateGameUI();
    checkEndTurnEnabled();
}

function showCard(card) {
    const modal = document.getElementById('card-modal');
    const display = document.getElementById('modal-card');

    let typeClass = '';
    let typeText = '';

    if (card.cardType === 'evento') {
        typeClass = card.type === 'positive' ? 'evento-positive' : 'evento-negative';
        typeText = 'EVENTO';
    } else if (card.cardType === 'problema') {
        typeClass = 'problema';
        typeText = 'PROBLEMA';
    } else if (card.cardType === 'solucion') {
        typeClass = 'solucion';
        typeText = 'SOLUCION';
    }

    display.className = `card-display ${typeClass}`;
    display.innerHTML = `
        <div class="card-type">${typeText}</div>
        <div class="card-title">${card.name}</div>
        <div class="card-effect">${card.effect}</div>
    `;

    modal.classList.add('active');
    applyCardEffect(card);
}

function applyCardEffect(card) {
    gameState.pendingCard = card;

    if (card.cardType === 'evento') {
        switch (card.action) {
            case 'ADD_NEXT_TEAM_ROLL':
                gameState.bonusDice += card.value;
                gameState.discardPile.push(card);
                break;

            case 'ADD_DICE':
                gameState.bonusDice += card.value;
                gameState.discardPile.push(card);
                break;

            case 'SKIP_TURN':
                gameState.skipNextTurn = true;
                gameState.discardPile.push(card);
                break;

            case 'SKIP_TEAM_TURN':
                gameState.currentPlayerIndex = gameState.team.members;
                gameState.discardPile.push(card);
                break;

            case 'ADD_HOURS':
                // Mostrar selector de historia para agregar horas
                showStorySelector('negative', card, 'Selecciona la historia que recibira 6 horas extra:');
                return; // No cerrar modal aun

            case 'COMPLETE_STORY':
                // Mostrar selector de historia para completar
                showStorySelector('positive', card, 'Selecciona la historia a completar instantaneamente:');
                return; // No cerrar modal aun

            case 'RESET_STORY':
                // Mostrar selector de historia para resetear
                showStorySelector('negative', card, 'Selecciona la historia que perdera todo su progreso:');
                return; // No cerrar modal aun

            case 'REDUCE_NEXT_TEAM_ROLL':
            case 'REDUCE_ALL_DICE':
                gameState.bonusDice -= card.value;
                gameState.discardPile.push(card);
                break;

            case 'DRAW_AGAIN':
                gameState.discardPile.push(card);
                setTimeout(() => {
                    closeCardModal();
                    gameState.turnActions.cardDrawn = false;
                    drawOpportunityCard();
                }, 1000);
                return;
        }

    } else if (card.cardType === 'problema') {
        if (gameState.selectedStory && gameState.selectedStory.status === 'doing') {
            gameState.selectedStory.problems.push(card);
        } else {
            // Si no hay historia seleccionada, mostrar selector
            showStorySelector('problem', card, 'Selecciona la historia que recibira este problema:');
            return;
        }

    } else if (card.cardType === 'solucion') {
        let resolved = false;

        gameState.backlog.forEach(story => {
            if (story.inSprint && story.problems.length > 0) {
                const problemIndex = story.problems.findIndex(p => p.solutionId === card.id);
                if (problemIndex !== -1 && !resolved) {
                    story.problems.splice(problemIndex, 1);
                    resolved = true;
                    checkStoryCompletion(story);
                    gameState.discardPile.push(card);
                }
            }
        });

        if (!resolved) {
            gameState.team.solutions.push(card);
        }
    }

    gameState.pendingCard = null;
    updateKanbanBoard();
    updateTeamSolutions();
    updateProblemsList();
}

function showStorySelector(type, card, message) {
    const modal = document.getElementById('story-selector-modal');
    const list = document.getElementById('story-selector-list');
    document.getElementById('story-selector-message').textContent = message;

    let stories = [];

    if (type === 'positive') {
        // Para completar: historias en progreso (doing)
        stories = gameState.backlog.filter(s => s.inSprint && s.status === 'doing' && s.problems.length === 0);
    } else if (type === 'negative' || type === 'problem') {
        // Para agregar horas o problemas: historias en doing
        stories = gameState.backlog.filter(s => s.inSprint && s.status === 'doing');
    }

    if (stories.length === 0) {
        // No hay historias elegibles, descartar carta sin efecto
        alert('No hay historias elegibles para aplicar este efecto.');
        gameState.discardPile.push(card);
        gameState.pendingCard = null;
        updateKanbanBoard();
        return;
    }

    list.innerHTML = '';
    stories.forEach(story => {
        const div = document.createElement('div');
        div.className = 'backlog-card';
        div.innerHTML = `
            <div class="story-header">
                <span class="story-id">#${story.id}</span>
                <span class="story-hours">${story.remainingHours}h restantes</span>
            </div>
            <div class="story-description">${story.description}</div>
        `;
        div.onclick = () => applyCardToStory(card, story, type);
        list.appendChild(div);
    });

    modal.classList.add('active');
}

function applyCardToStory(card, story, type) {
    document.getElementById('story-selector-modal').classList.remove('active');

    if (card.action === 'ADD_HOURS') {
        story.remainingHours += card.value;
    } else if (card.action === 'COMPLETE_STORY') {
        story.remainingHours = 0;
        checkStoryCompletion(story);
    } else if (card.action === 'RESET_STORY') {
        story.remainingHours = story.originalHours;
    } else if (type === 'problem') {
        story.problems.push(card);
        gameState.pendingCard = null;
        updateKanbanBoard();
        updateProblemsList();
        return; // No descartar problemas
    }

    gameState.discardPile.push(card);
    gameState.pendingCard = null;
    updateKanbanBoard();
    updateTeamSolutions();
    updateProblemsList();
}

function closeStorySelectorModal() {
    document.getElementById('story-selector-modal').classList.remove('active');
    // Si se cierra sin elegir, descartar la carta sin efecto
    if (gameState.pendingCard) {
        gameState.discardPile.push(gameState.pendingCard);
        gameState.pendingCard = null;
    }
}

function closeCardModal() {
    document.getElementById('card-modal').classList.remove('active');
    checkEndTurnEnabled();
}

function updateTeamSolutions() {
    const container = document.getElementById('team-solutions');

    if (gameState.team.solutions.length === 0) {
        container.innerHTML = '<p class="empty-message">Sin soluciones guardadas</p>';
        return;
    }

    container.innerHTML = '';
    gameState.team.solutions.forEach((sol, index) => {
        const div = document.createElement('div');
        div.className = 'solution-item';
        div.innerHTML = `<strong>${sol.name}</strong><br><small>${sol.effect}</small>`;
        div.onclick = () => tryApplySolution(index);
        container.appendChild(div);
    });
}

function tryApplySolution(solutionIndex) {
    const solution = gameState.team.solutions[solutionIndex];

    let targetStory = null;
    let targetProblemIndex = -1;

    gameState.backlog.forEach(story => {
        if (story.inSprint && story.problems.length > 0) {
            const pIndex = story.problems.findIndex(p => p.solutionId === solution.id);
            if (pIndex !== -1 && !targetStory) {
                targetStory = story;
                targetProblemIndex = pIndex;
            }
        }
    });

    if (targetStory) {
        targetStory.problems.splice(targetProblemIndex, 1);
        gameState.team.solutions.splice(solutionIndex, 1);
        gameState.discardPile.push(solution);
        checkStoryCompletion(targetStory);
        updateKanbanBoard();
        updateTeamSolutions();
        updateProblemsList();
        alert(`Solucion aplicada! Historia #${targetStory.id} desbloqueada.`);
    } else {
        alert('No hay problemas que esta solucion pueda resolver en este momento.');
    }
}

function updateProblemsList() {
    const container = document.getElementById('problems-list');
    const problems = [];

    gameState.backlog.forEach(story => {
        if (story.inSprint && story.problems.length > 0) {
            story.problems.forEach(p => {
                problems.push({ problem: p, storyId: story.id });
            });
        }
    });

    if (problems.length === 0) {
        container.innerHTML = '<p class="empty-message">Sin problemas activos</p>';
        return;
    }

    container.innerHTML = '';
    problems.forEach(({ problem, storyId }) => {
        const div = document.createElement('div');
        div.className = 'problem-item';
        div.innerHTML = `
            <div class="problem-name">${problem.name}</div>
            <div class="problem-story">Bloquea Historia #${storyId}</div>
        `;
        container.appendChild(div);
    });
}

function checkEndTurnEnabled() {
    const allDone = gameState.turnActions.selected &&
        gameState.turnActions.diceRolled &&
        gameState.turnActions.hoursDeducted &&
        gameState.turnActions.cardDrawn;

    document.getElementById('end-turn').disabled = !allDone;
}

function resetTurnActions() {
    gameState.turnActions = {
        selected: false,
        diceRolled: false,
        hoursDeducted: false,
        cardDrawn: false
    };
    gameState.selectedStory = null;
    gameState.diceResult = null;

    document.getElementById('action-select').checked = false;
    document.getElementById('action-dice').checked = false;
    document.getElementById('action-work').checked = false;
    document.getElementById('action-card').checked = false;
    document.getElementById('end-turn').disabled = true;

    document.getElementById('die1').textContent = '?';
    document.getElementById('die2').textContent = '?';
    document.getElementById('dice-result').textContent = '-';
}

function endTurn() {
    gameState.currentPlayerIndex++;

    // Si todos los jugadores del equipo jugaron este dia
    if (gameState.currentPlayerIndex >= gameState.team.members) {
        gameState.currentPlayerIndex = 0;
        gameState.currentDay++;

        // Si terminaron los 3 dias del sprint
        if (gameState.currentDay > 3) {
            endSprint();
            return;
        }
    }

    // Manejar salto de turno
    if (gameState.skipNextTurn) {
        gameState.skipNextTurn = false;
        endTurn();
        return;
    }

    resetTurnActions();
    updateGameUI();
}

function endSprint() {
    const modal = document.getElementById('sprint-end-modal');
    document.getElementById('ended-sprint-num').textContent = gameState.currentSprint;

    const completed = gameState.backlog.filter(s => s.inSprint && s.status === 'done');
    const incomplete = gameState.backlog.filter(s => s.inSprint && s.status !== 'done');

    const sprintPoints = completed.reduce((sum, s) => sum + s.originalHours, 0);

    gameState.team.sprintHistory.push({
        sprint: gameState.currentSprint,
        completed: completed.length,
        points: sprintPoints
    });

    let summaryHTML = `
        <div class="sprint-summary-section">
            <h3>Resultados del Sprint ${gameState.currentSprint}</h3>

            <p><strong>Historias completadas:</strong> ${completed.length}</p>
            <div class="completed-stories-list">
                ${completed.map(s => `<span class="completed-story-tag">#${s.id} (${s.originalHours}h)</span>`).join('') || '<span style="color: #64748b;">Ninguna</span>'}
            </div>

            ${incomplete.length > 0 ? `
                <p style="margin-top: 1rem;"><strong>Historias incompletas:</strong></p>
                <div class="completed-stories-list">
                    ${incomplete.map(s => `<span class="incomplete-story-tag">#${s.id} (${s.remainingHours}h restantes${s.problems.length > 0 ? ' - BLOQUEADA' : ''})</span>`).join('')}
                </div>
            ` : ''}

            <div style="margin-top: 1.5rem; padding: 1rem; background: #f0fdf4; border-radius: 8px;">
                <p><strong>Puntos este sprint:</strong> ${sprintPoints}</p>
                <p><strong>Puntos totales acumulados:</strong> ${gameState.team.totalPoints}</p>
            </div>
        </div>

        <div class="sprint-summary-section">
            <h3>Preguntas para la Retrospectiva</h3>
            <ul style="margin-left: 1.5rem;">
                <li>Que funciono bien en este sprint?</li>
                <li>Como manejamos los bloqueos?</li>
                <li>Que podemos mejorar para el proximo sprint?</li>
            </ul>
        </div>
    `;

    document.getElementById('sprint-summary').innerHTML = summaryHTML;
    modal.classList.add('active');
}

function startNextSprint() {
    document.getElementById('sprint-end-modal').classList.remove('active');

    gameState.currentSprint++;

    if (gameState.currentSprint > gameState.totalSprints) {
        endGame();
        return;
    }

    gameState.currentDay = 1;
    gameState.currentPlayerIndex = 0;

    // Reciclar mazo si es necesario
    if (gameState.opportunityDeck.length < 10) {
        gameState.opportunityDeck = shuffleArray([...gameState.opportunityDeck, ...gameState.discardPile]);
        gameState.discardPile = [];
    }

    resetTurnActions();
    updateGameUI();
}

function endGame() {
    const modal = document.getElementById('game-end-modal');

    const totalStories = gameState.team.completedStories.length;
    const totalPoints = gameState.team.totalPoints;

    let resultsHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <h3 style="font-size: 1.5rem; color: #22c55e;">Felicitaciones ${gameState.team.name}!</h3>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: #dbeafe; padding: 1.5rem; border-radius: 12px; text-align: center;">
                <div style="font-size: 2.5rem; font-weight: bold; color: #2563eb;">${totalStories}</div>
                <div style="color: #64748b;">Historias Completadas</div>
            </div>
            <div style="background: #dcfce7; padding: 1.5rem; border-radius: 12px; text-align: center;">
                <div style="font-size: 2.5rem; font-weight: bold; color: #16a34a;">${totalPoints}</div>
                <div style="color: #64748b;">Puntos Totales</div>
            </div>
        </div>

        <h3>Historial por Sprint</h3>
        <table class="scoreboard-table">
            <thead>
                <tr>
                    <th>Sprint</th>
                    <th>Historias</th>
                    <th>Puntos</th>
                </tr>
            </thead>
            <tbody>
                ${gameState.team.sprintHistory.map(sh => `
                    <tr>
                        <td>Sprint ${sh.sprint}</td>
                        <td>${sh.completed}</td>
                        <td>${sh.points}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 2rem; padding: 1.5rem; background: #fef3c7; border-radius: 12px;">
            <h3 style="margin-bottom: 1rem;">Preguntas para la Retrospectiva Final</h3>
            <ul style="margin-left: 1.5rem;">
                <li>Que estrategias funcionaron mejor para completar historias?</li>
                <li>Como manejaron los problemas y bloqueos?</li>
                <li>Que aprendieron sobre trabajo en equipo y priorizacion?</li>
                <li>Como se relaciona esto con proyectos reales de RRHH?</li>
                <li>Que harian diferente si volvieran a jugar?</li>
            </ul>
        </div>
    `;

    document.getElementById('final-results').innerHTML = resultsHTML;
    modal.classList.add('active');
}

function restartGame() {
    document.getElementById('game-end-modal').classList.remove('active');
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('config-screen').classList.add('active');

    gameState = {
        team: {
            name: 'Mi Equipo',
            members: 4,
            solutions: [],
            completedStories: [],
            totalPoints: 0,
            sprintHistory: []
        },
        currentPlayerIndex: 0,
        currentSprint: 1,
        currentDay: 1,
        totalSprints: 2,
        backlog: [],
        opportunityDeck: [],
        discardPile: [],
        selectedStory: null,
        diceResult: null,
        turnActions: {
            selected: false,
            diceRolled: false,
            hoursDeducted: false,
            cardDrawn: false
        },
        skipNextTurn: false,
        bonusDice: 0
    };
}

function showRules() {
    const rulesContent = document.querySelector('#rules-modal .rules-content');
    if (rulesContent && !document.getElementById('event-card-reference')) {
        const eventReference = document.createElement('section');
        eventReference.id = 'event-card-reference';
        eventReference.innerHTML = `
            <h3>Referencia de Eventos</h3>
            <ul>
                ${EVENTOS.map(evento => `
                    <li><strong>${evento.name}:</strong> ${evento.effect}</li>
                `).join('')}
            </ul>
        `;
        rulesContent.appendChild(eventReference);
    }

    document.getElementById('rules-modal').classList.add('active');
}

function closeRulesModal() {
    document.getElementById('rules-modal').classList.remove('active');
}

function showStats() {
    const modal = document.getElementById('stats-modal');

    const inProgress = gameState.backlog.filter(s => s.inSprint && s.status === 'doing');
    const completed = gameState.backlog.filter(s => s.inSprint && s.status === 'done');
    const blocked = gameState.backlog.filter(s => s.inSprint && s.problems.length > 0);

    let html = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold;">${inProgress.length}</div>
                <div style="font-size: 0.875rem; color: #64748b;">En Progreso</div>
            </div>
            <div style="background: #dcfce7; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold;">${completed.length}</div>
                <div style="font-size: 0.875rem; color: #64748b;">Completadas</div>
            </div>
            <div style="background: #fee2e2; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold;">${blocked.length}</div>
                <div style="font-size: 0.875rem; color: #64748b;">Bloqueadas</div>
            </div>
        </div>

        <h3>Estado Actual</h3>
        <table class="scoreboard-table">
            <tr><td>Equipo</td><td><strong>${gameState.team.name}</strong></td></tr>
            <tr><td>Integrantes</td><td>${gameState.team.members}</td></tr>
            <tr><td>Sprint Actual</td><td>${gameState.currentSprint} de ${gameState.totalSprints}</td></tr>
            <tr><td>Dia</td><td>${gameState.currentDay} de 3</td></tr>
            <tr><td>Soluciones Guardadas</td><td>${gameState.team.solutions.length}</td></tr>
            <tr><td>Puntos Acumulados</td><td><strong>${gameState.team.totalPoints}</strong></td></tr>
        </table>

        ${gameState.team.sprintHistory.length > 0 ? `
            <h3 style="margin-top: 1.5rem;">Historial de Sprints</h3>
            <table class="scoreboard-table">
                <thead>
                    <tr><th>Sprint</th><th>Historias</th><th>Puntos</th></tr>
                </thead>
                <tbody>
                    ${gameState.team.sprintHistory.map(sh => `
                        <tr>
                            <td>Sprint ${sh.sprint}</td>
                            <td>${sh.completed}</td>
                            <td>${sh.points}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : ''}
    `;

    document.getElementById('stats-content').innerHTML = html;
    modal.classList.add('active');
}

function closeStatsModal() {
    document.getElementById('stats-modal').classList.remove('active');
}
