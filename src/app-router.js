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
    const sync = createConfiguredSyncService();

    if (!root) {
        return;
    }

    if (mode === "teacher") {
        document.getElementById("app")?.classList.add("hidden");
        root.classList.remove("hidden");
        createTeacherApp(root, { sync });
    }

    if (mode === "team") {
        document.getElementById("app")?.classList.add("hidden");
        root.classList.remove("hidden");
        createTeamApp(root, { sync });
    }
});
