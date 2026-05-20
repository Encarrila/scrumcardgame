import { createCatalog, createOpportunityDeck } from "./catalog.js";
import { createInitialTeamState } from "./game-engine.js";
import { createLocalSyncService } from "./sync/local-sync-service.js";

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function createTeamState(name, totalSprints, catalog) {
    const state = createInitialTeamState({ teamName: name, totalSprints, catalog });
    state.opportunityDeck = createOpportunityDeck(catalog);
    return state;
}

function summarizeTeam(team) {
    const state = team.state;
    const participants = state?.participants?.length ?? 0;
    const active = state?.participants?.find((participant) => participant.id === state.activeParticipantId);
    const blocked = state?.backlog?.filter((story) => story.problems.length > 0).length ?? 0;
    const done = state?.backlog?.filter((story) => story.status === "done").length ?? 0;
    return `
        <article class="team-summary">
            <h2>${escapeHtml(team.name)}</h2>
            <p>Codigo: <strong>${escapeHtml(team.teamCode)}</strong></p>
            <p>Participantes: ${participants}</p>
            <p>Turno: <strong>${escapeHtml(active?.displayName ?? "Sin jugadores")}</strong></p>
            <p>Sprint ${state?.currentSprint ?? "-"} / Dia ${state?.currentDay ?? "-"}</p>
            <p>DONE: ${done} | Bloqueadas: ${blocked} | Puntos: ${state?.totalPoints ?? 0}</p>
            <p>Estado: ${state?.gameStatus === "finished" ? "Finalizado" : state?.sessionPaused ? "Pausado" : "Activo"}</p>
            <a href="?mode=team&session=${team.sessionId}&team=${team.id}">Abrir sala del equipo</a>
        </article>
    `;
}

function renderSession(root, sync, sessionId) {
    const session = sync.getSession(sessionId);
    root.querySelector("#teacher-output").innerHTML = `
        <section class="remote-panel teacher-session-bar">
            <div>
                <h2>${escapeHtml(session.name)}</h2>
                <p>${session.teams.length} equipos | ${session.status}</p>
            </div>
            <div class="teacher-actions">
                <button id="pause-session" class="btn-secondary">${session.status === "paused" ? "Reanudar" : "Pausar"}</button>
                <button id="reset-session" class="btn-secondary">Reiniciar equipos</button>
            </div>
        </section>
        <section class="remote-grid">
            ${session.teams.map(summarizeTeam).join("")}
        </section>
    `;

    root.querySelector("#pause-session").addEventListener("click", () => {
        const paused = session.status !== "paused";
        sync.setSessionStatus({ sessionId, status: paused ? "paused" : "active" });
        for (const team of session.teams) {
            sync.saveTeamState({
                teamId: team.id,
                expectedVersion: team.stateVersion,
                state: { ...team.state, sessionPaused: paused }
            });
        }
        renderSession(root, sync, sessionId);
    });

    root.querySelector("#reset-session").addEventListener("click", () => {
        const catalog = createCatalog();
        for (const team of session.teams) {
            const currentState = team.state;
            const resetState = createTeamState(team.name, session.totalSprints, catalog);
            resetState.participants = currentState.participants;
            resetState.activeParticipantId = currentState.participants[0]?.id ?? null;
            sync.saveTeamState({ teamId: team.id, expectedVersion: team.stateVersion, state: resetState });
        }
        sync.setSessionStatus({ sessionId, status: "active" });
        renderSession(root, sync, sessionId);
    });
}

export function createTeacherApp(root, { sync = createLocalSyncService() } = {}) {
    let currentSessionId = window.localStorage.getItem("scrum-card-game-last-session");

    root.innerHTML = `
        <main class="remote-page">
            <header class="remote-header">
                <div>
                    <h1>Scrum Card Game</h1>
                    <p>Panel docente</p>
                </div>
            </header>
            <section class="remote-panel">
                <label for="session-name">Nombre de la sesion</label>
                <input id="session-name" class="text-input" value="Clase Scrum Card Game">
                <label for="session-sprints">Cantidad de sprints</label>
                <input id="session-sprints" class="text-input" type="number" min="1" max="5" value="2">
                <button id="create-session" class="btn-primary">Crear sesion local</button>
            </section>
            <section id="teacher-output"></section>
        </main>
    `;

    if (currentSessionId) {
        try {
            renderSession(root, sync, currentSessionId);
        } catch {
            window.localStorage.removeItem("scrum-card-game-last-session");
            currentSessionId = null;
        }
    }

    root.querySelector("#create-session").addEventListener("click", () => {
        const session = sync.createSession({
            name: root.querySelector("#session-name").value,
            totalSprints: Number(root.querySelector("#session-sprints").value)
        });
        const catalog = createCatalog();
        ["Equipo 1", "Equipo 2", "Equipo 3"].forEach((name) =>
            sync.createTeam({
                sessionId: session.id,
                name,
                initialState: createTeamState(name, session.totalSprints, catalog)
            })
        );

        currentSessionId = session.id;
        window.localStorage.setItem("scrum-card-game-last-session", session.id);
        renderSession(root, sync, currentSessionId);
    });
}
