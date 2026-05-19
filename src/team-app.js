import { joinParticipant } from "./game-engine.js";
import { createLocalSyncService } from "./sync/local-sync-service.js";

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

function renderTeam(root, team) {
    if (!team?.state?.participants) {
        renderMissingTeam(root);
        return;
    }

    const active = team.state.participants.find((participant) => participant.id === team.state.activeParticipantId);
    root.querySelector("#team-output").innerHTML = `
        <h2>${escapeHtml(team.name)}</h2>
        <p>Participantes: ${team.state.participants.map((participant) => escapeHtml(participant.displayName)).join(", ") || "Sin participantes"}</p>
        <p>Turno activo: <strong>${escapeHtml(active?.displayName ?? "Sin participante activo")}</strong></p>
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
        let currentTeam;
        try {
            currentTeam = await loadTeam(sync, teamId);
        } catch {
            renderSaveError(root);
            return;
        }

        const participantId = participantToken();
        const nextState = joinParticipant(currentTeam.state, {
            participantId,
            displayName: root.querySelector("#participant-name").value || "Participante"
        });
        try {
            const saved = sync.saveTeamState({
                teamId,
                expectedVersion: currentTeam.stateVersion,
                state: nextState
            });
            renderTeam(root, await saved);
        } catch {
            renderSaveError(root);
        }
    });
}
