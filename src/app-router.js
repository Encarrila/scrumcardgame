import { createTeacherApp } from "./teacher-app.js";
import { createTeamApp } from "./team-app.js";
import { createConfiguredSyncService } from "./sync/sync-factory.js";

function getMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") ?? "legacy";
}

document.addEventListener("DOMContentLoaded", () => {
    const mode = getMode();
    const root = document.getElementById("remote-app");

    if (!root) {
        return;
    }

    if (mode !== "teacher" && mode !== "team") {
        return;
    }

    document.getElementById("app")?.classList.add("hidden");
    root.classList.remove("hidden");

    let sync;
    try {
        sync = createConfiguredSyncService();
    } catch (error) {
        root.innerHTML = `
            <main class="remote-page">
                <header class="remote-header">
                    <div>
                        <h1>Scrum Card Game</h1>
                        <p>No se pudo iniciar la sala remota</p>
                    </div>
                </header>
                <section class="remote-panel">
                    <p>${String(error?.message ?? error)}</p>
                </section>
            </main>
        `;
        return;
    }

    if (mode === "teacher") {
        createTeacherApp(root, { sync });
    }

    if (mode === "team") {
        createTeamApp(root, { sync });
    }
});
