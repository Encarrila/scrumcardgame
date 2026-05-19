import { joinParticipant } from "./game-engine.js";
import { createLocalSyncService } from "./sync/local-sync-service.js";

const DB_KEY = "scrum-card-game-db";
const PARTICIPANT_KEY = "scrum-card-game-participant-id";

function participantToken() {
    const existing = window.localStorage.getItem(PARTICIPANT_KEY);
    if (existing) {
        return existing;
    }

    const created = crypto.randomUUID();
    window.localStorage.setItem(PARTICIPANT_KEY, created);
    return created;
}

function findTeam(teamId) {
    if (!teamId) {
        return null;
    }

    const db = JSON.parse(window.localStorage.getItem(DB_KEY) ?? '{"teams":[]}');
    return db.teams.find((candidate) => candidate.id === teamId) ?? null;
}

function renderTeam(root, team) {
    if (!team?.state?.participants) {
        renderMissingTeam(root);
        return;
    }

    const active = team.state.participants.find((participant) => participant.id === team.state.activeParticipantId);
    root.querySelector("#team-output").innerHTML = `
        <h2>${team.name}</h2>
        <p>Participantes: ${team.state.participants.map((participant) => participant.displayName).join(", ") || "Sin participantes"}</p>
        <p>Turno activo: <strong>${active?.displayName ?? "Sin participante activo"}</strong></p>
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

export function createTeamApp(root) {
    const params = new URLSearchParams(window.location.search);
    const teamId = params.get("team");
    const sync = createLocalSyncService();

    if (!findTeam(teamId)) {
        renderMissingTeam(root);
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

    renderTeam(root, findTeam(teamId));

    root.querySelector("#join-team").addEventListener("click", () => {
        const team = findTeam(teamId);
        if (!team?.state?.participants) {
            renderMissingTeam(root);
            return;
        }

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

        renderTeam(root, saved);
    });
}
