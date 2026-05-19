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
                <label for="session-name">Nombre de la sesion</label>
                <input id="session-name" class="text-input" value="Clase Scrum Card Game">
                <label for="session-sprints">Cantidad de sprints</label>
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
                initialState: createInitialTeamState({
                    teamName: name,
                    totalSprints: session.totalSprints,
                    catalog
                })
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
