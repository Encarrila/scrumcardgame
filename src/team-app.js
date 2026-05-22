import {
    applyCardToState,
    endTurn,
    joinParticipant,
    rollDiceForSelectedStory,
    selectStoryForTurn
} from "./game-engine.js";
import { createLocalSyncService } from "./sync/local-sync-service.js";
import { createOpportunityDeck, shuffleArray } from "./catalog.js";

const PARTICIPANT_KEY = "scrum-card-game-participant-id";

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function participantToken() {
    const existing = window.localStorage.getItem(PARTICIPANT_KEY);
    if (existing) {
        return existing;
    }

    const created = crypto.randomUUID();
    window.localStorage.setItem(PARTICIPANT_KEY, created);
    return created;
}

function storyColumn(state, status, title) {
    const stories = state.backlog.filter((story) => (
        status === "backlog"
            ? story.status === "backlog"
            : story.inSprint && story.status === status
    ));
    return `
        <section class="remote-board-column">
            <h3>${title} <span>${stories.length}</span></h3>
            ${stories.map((story) => `
                <button class="remote-story ${story.problems.length ? "blocked" : ""}" data-action="select-story" data-story-id="${story.id}">
                    <span>#${story.id} - ${story.remainingHours}h</span>
                    <strong>${escapeHtml(story.description)}</strong>
                    ${story.problems.length ? `<small>Bloqueos: ${story.problems.map((problem) => escapeHtml(problem.name)).join(", ")}</small>` : ""}
                </button>
            `).join("") || `<p class="empty-message">Sin historias</p>`}
        </section>
    `;
}

function renderReferenceCards() {
    const deck = createOpportunityDeck();
    return `
        <details class="remote-reference">
            <summary>Referencia de cartas</summary>
            <div class="reference-grid">
                ${deck.map((card) => `
                    <article>
                        <strong>${escapeHtml(card.name)}</strong>
                        <span>${escapeHtml(card.cardType)}</span>
                        <p>${escapeHtml(card.effect)}</p>
                    </article>
                `).join("")}
            </div>
        </details>
    `;
}

function renderTeam(root, team) {
    if (!team?.state?.participants) {
        renderMissingTeam(root);
        return;
    }

    const backlog = team.state.backlog ?? [];
    const solutions = team.state.solutions ?? [];
    const opportunityDeck = team.state.opportunityDeck ?? [];
    const discardPile = team.state.discardPile ?? [];
    const currentParticipantId = window.localStorage.getItem(PARTICIPANT_KEY);
    const isActive = currentParticipantId === team.state.activeParticipantId;
    const active = team.state.participants.find((participant) => participant.id === team.state.activeParticipantId);
    const selectedStory = backlog.find((story) => story.id === team.state.selectedStoryId);
    const problems = backlog.flatMap((story) => (
        story.problems.map((problem) => ({ storyId: story.id, problem }))
    ));
    const renderState = { ...team.state, backlog };
    root.querySelector("#team-output").innerHTML = `
        <div class="team-game-header">
            <div>
                <h2>${escapeHtml(team.name)}</h2>
                <p>Participantes: ${team.state.participants.map((participant) => escapeHtml(participant.displayName)).join(", ") || "Sin participantes"}</p>
                <p>Turno activo: <strong>${escapeHtml(active?.displayName ?? "Sin participante activo")}</strong>${isActive ? " - es tu turno" : ""}</p>
            </div>
            <div class="team-status">
                <span>Sprint ${team.state.currentSprint ?? "-"}/${team.state.totalSprints ?? "-"}</span>
                <span>Dia ${team.state.currentDay ?? "-"}/3</span>
                <span>${team.state.gameStatus === "finished" ? "Finalizado" : team.state.sessionPaused ? "Pausado" : "Activo"}</span>
            </div>
        </div>

        <div class="team-action-panel">
            <p>Historia seleccionada: <strong>${selectedStory ? `#${selectedStory.id} (${selectedStory.remainingHours}h)` : "Ninguna"}</strong></p>
            <p>Dados: <strong>${team.state.diceResult ?? "-"}</strong> | Bonus proxima tirada: <strong>${team.state.pendingTeamRollBonus ?? 0}</strong></p>
            <p>Mazo: ${opportunityDeck.length} | Descarte: ${discardPile.length} | Soluciones: ${solutions.length}</p>
            <div class="team-actions">
                <button class="btn-secondary" data-action="roll-dice" ${isActive && team.state.turnActions.selected && !team.state.turnActions.diceRolled ? "" : "disabled"}>Tirar dados</button>
                <button class="btn-secondary" data-action="draw-card" ${isActive && team.state.turnActions.diceRolled && !team.state.turnActions.cardDrawn ? "" : "disabled"}>Tomar oportunidad</button>
                <button class="btn-primary" data-action="end-turn" ${isActive && team.state.turnActions.selected && team.state.turnActions.diceRolled && team.state.turnActions.cardDrawn ? "" : "disabled"}>Cerrar turno</button>
            </div>
        </div>

        <div class="remote-board">
            ${storyColumn(renderState, "backlog", "Backlog")}
            ${storyColumn(renderState, "doing", "Doing")}
            ${storyColumn(renderState, "done", "Done")}
        </div>

        <section class="remote-panel compact">
            <h3>Problemas activos</h3>
            ${problems.map(({ storyId, problem }) => `<p><strong>#${storyId}</strong> ${escapeHtml(problem.name)}</p>`).join("") || `<p class="empty-message">Sin problemas</p>`}
            <h3>Soluciones guardadas</h3>
            ${solutions.map((solution) => `<p>${escapeHtml(solution.name)}: ${escapeHtml(solution.effect)}</p>`).join("") || `<p class="empty-message">Sin soluciones guardadas</p>`}
        </section>

        ${renderReferenceCards()}
    `;
}

function renderLocalStorageError(root) {
    root.innerHTML = `
        <main class="remote-page">
            <header class="remote-header">
                <div>
                    <h1>Sala de equipo</h1>
                    <p>No se pudo leer la sala local</p>
                </div>
            </header>
            <section class="remote-panel">
                <p>Los datos guardados en este navegador no se pudieron interpretar. Actualiza la pagina o vuelve a abrir la sala desde el panel docente.</p>
                <a href="?mode=teacher">Abrir panel docente</a>
            </section>
        </main>
    `;
}

function renderSaveError(root) {
    root.querySelector("#team-output").innerHTML = `
        <h2>No se pudo guardar tu ingreso</h2>
        <p>La sala cambio o ya no esta disponible; actualiza la sala e intenta nuevamente.</p>
    `;
}

function renderActionError(root, message) {
    const output = root.querySelector("#team-output");
    output.insertAdjacentHTML("afterbegin", `<div class="remote-error">${escapeHtml(message)}</div>`);
}

function renderLoadingTeam(root) {
    root.innerHTML = `
        <main class="remote-page">
            <header class="remote-header">
                <div>
                    <h1>Sala de equipo</h1>
                    <p>Cargando sala de equipo</p>
                </div>
            </header>
            <section class="remote-panel">
                <p>Estamos preparando la sala.</p>
            </section>
        </main>
    `;
}

function renderMissingTeam(root) {
    root.innerHTML = `
        <main class="remote-page">
            <header class="remote-header">
                <div>
                    <h1>Sala de equipo</h1>
                    <p>No se encontro el equipo solicitado</p>
                </div>
            </header>
            <section class="remote-panel">
                <p>Revisa que el enlace de la sala sea correcto o crea una nueva sesion local desde el panel docente.</p>
                <a href="?mode=teacher">Abrir panel docente</a>
            </section>
        </main>
    `;
}

function isStorageParseError(error) {
    return error instanceof SyntaxError;
}

function loadTeam(sync, teamId) {
    if (!teamId) {
        throw new Error("Team id is required");
    }
    return sync.getTeam(teamId);
}

async function saveUpdatedTeam(root, sync, teamId, update) {
    const currentTeam = await loadTeam(sync, teamId);
    const nextState = update(currentTeam.state);
    const saved = await sync.saveTeamState({
        teamId,
        expectedVersion: currentTeam.stateVersion,
        state: nextState
    });
    renderTeam(root, saved);
    return saved;
}

function drawCardForParticipant(state, participantId) {
    const next = structuredClone(state);
    if (next.opportunityDeck.length === 0 && next.discardPile.length > 0) {
        next.opportunityDeck = shuffleArray(next.discardPile);
        next.discardPile = [];
    }
    if (next.opportunityDeck.length === 0) {
        next.turnActions.cardDrawn = true;
        return next;
    }
    const [card, ...remainingDeck] = next.opportunityDeck;
    next.opportunityDeck = remainingDeck;
    return applyCardToState(next, {
        participantId,
        card,
        targetStoryId: next.selectedStoryId
    });
}

export async function createTeamApp(root, { sync = createLocalSyncService() } = {}) {
    const params = new URLSearchParams(window.location.search);
    const teamId = params.get("team");
    let team;

    renderLoadingTeam(root);

    try {
        team = await loadTeam(sync, teamId);
    } catch (error) {
        if (isStorageParseError(error)) {
            renderLocalStorageError(root);
        } else {
            renderMissingTeam(root);
        }
        return;
    }

    root.innerHTML = `
        <main class="remote-page">
            <header class="remote-header">
                <div>
                    <h1>Sala de equipo</h1>
                    <p>Ingreso remoto por nombre</p>
                </div>
            </header>
            <section class="remote-panel">
                <label for="participant-name">Tu nombre</label>
                <input id="participant-name" class="text-input" placeholder="Nombre">
                <button id="join-team" class="btn-primary">Entrar</button>
            </section>
            <section id="team-output" class="remote-panel"></section>
        </main>
    `;

    renderTeam(root, team);

    root.querySelector("#join-team").addEventListener("click", async () => {
        const participantId = participantToken();
        try {
            await saveUpdatedTeam(root, sync, teamId, (state) => joinParticipant(state, {
                participantId,
                displayName: root.querySelector("#participant-name").value || "Participante"
            }));
        } catch {
            renderSaveError(root);
        }
    });

    root.querySelector("#team-output").addEventListener?.("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button || button.disabled) {
            return;
        }

        const participantId = participantToken();
        const action = button.dataset.action;
        try {
            if (action === "select-story") {
                const storyId = Number(button.dataset.storyId);
                await saveUpdatedTeam(root, sync, teamId, (state) => selectStoryForTurn(state, { participantId, storyId }));
            }
            if (action === "roll-dice") {
                const dice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
                await saveUpdatedTeam(root, sync, teamId, (state) => rollDiceForSelectedStory(state, { participantId, dice }));
            }
            if (action === "draw-card") {
                await saveUpdatedTeam(root, sync, teamId, (state) => drawCardForParticipant(state, participantId));
            }
            if (action === "end-turn") {
                await saveUpdatedTeam(root, sync, teamId, (state) => endTurn(state, { participantId }));
            }
        } catch (error) {
            try {
                renderTeam(root, await loadTeam(sync, teamId));
                renderActionError(root, error.message || "No se pudo aplicar la accion.");
            } catch {
                renderSaveError(root);
            }
        }
    });
}
