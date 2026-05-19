# Remote Multiteam Scrum Card Game Design

## Context

The current Scrum Card Game implementation is a standalone browser app for one team per local instance. It already models the core game loop: backlog, sprint board, turns, dice, opportunity cards, problems, solutions, sprint summaries, and final results.

The next version must support a remote class where multiple student teams play from different computers while the instructor can observe and intervene when needed.

The 2026 printed instructions define the canonical flow:

- Each sprint has three days.
- Each day, every team member takes one turn.
- On a turn, the active player selects a story, rolls two dice, subtracts productive hours, draws an opportunity card, and applies it.
- Problems block a story from moving to DONE, but do not prevent the team from continuing to subtract hours.
- A story is DONE only when it has zero remaining hours and no active problems.
- At sprint end, teams compare planned work against completed work and run review/retrospective discussion.

## Goals

- Support remote play with several teams in the same class session.
- Let each team progress at its own pace.
- Let the instructor see all teams live.
- Let the instructor pause, resume, and restart the game when needed.
- Avoid formal login for students.
- Let students join a team dynamically by link/code and name.
- Restrict game actions to the active player in that team.
- Keep card/story datasets editable between editions without building a visual editor in the first version.
- Include automated tests for the game rules and known bug cases.

## Non-Goals

- No visual card editor in the first version.
- No formal user accounts or passwords.
- No payment-dependent backend requirement.
- No complex administrative platform beyond what is needed for live class facilitation.

## Recommended Architecture

Use a static frontend plus Supabase Free for initial persistence and realtime sync.

GitHub Pages or another static host can serve the frontend. Supabase stores sessions, teams, participants, game snapshots, and selected event logs. The app should keep the game logic independent from Supabase so a future provider change is possible.

The code should be split into these conceptual modules:

- `game-engine`: pure game logic. It receives a state and an action, validates the action, and returns the next state.
- `data/catalog`: editable edition data for stories, events, problems, and solutions.
- `sync`: persistence/realtime interface with methods such as `createSession`, `joinTeam`, `saveTeamState`, `subscribeToTeam`, `pauseSession`, and `resetTeam`.
- `teacher-ui`: instructor session creation, dashboard, controls, and team detail.
- `team-ui`: student team room, board, turn controls, cards reference, sprint review, and retrospectives.
- `tests`: unit tests for `game-engine` and integration tests for critical action flows.

## Data Model

### `game_sessions`

Represents a class session.

Fields:

- `id`
- `name`
- `status`: `draft`, `active`, `paused`, `finished`
- `total_sprints`
- `catalog_version`
- `teacher_code`
- `created_at`
- `updated_at`

### `teams`

Represents one team within a session.

Fields:

- `id`
- `session_id`
- `name`
- `team_code`
- `state`
- `state_version`
- `created_at`
- `updated_at`

`state` is a compact JSON snapshot including sprint, day, active participant, backlog, selected story, opportunity deck, discard pile, solutions, pending bonuses, score, sprint history, and current turn checklist.

### `participants`

Represents a student browser/person in a team.

Fields:

- `id`
- `session_id`
- `team_id`
- `display_name`
- `participant_token_hash`
- `turn_order`
- `joined_at`
- `last_seen_at`

The browser stores a local participant token. The database stores a hash or opaque value so the app can identify the same browser on reload.

### `game_events`

Optional event log for important actions.

Fields:

- `id`
- `session_id`
- `team_id`
- `participant_id`
- `type`
- `payload`
- `created_at`

Log meaningful game actions only: dice roll, card draw, card effect, story completed, problem added, solution applied, sprint ended, pause/resume, reset. Do not log small UI interactions.

## Session Flow

1. The instructor creates a session.
2. The app generates team links/codes.
3. Students join a team link, enter their name, and become participants dynamically.
4. Teams should target 4 to 6 students, but the system remains flexible.
5. A team starts when ready.
6. The active participant is the only browser allowed to run turn actions.
7. Each valid action updates the team state snapshot and increments `state_version`.
8. Supabase realtime notifies the team room and instructor dashboard.
9. The instructor can pause/resume the session globally.
10. The instructor can restart one team or the full session.

## Team Room UX

The team room includes:

- TO DO / DOING / DONE board.
- Backlog and sprint selection.
- Current sprint/day/player indicator.
- Turn checklist.
- Dice panel.
- Opportunity deck and revealed card modal.
- Problems active in the team.
- Solutions saved by the team.
- Pending bonuses, including the next-roll team bonus.
- Cards reference/catalog for stories, events, problems, and solutions.
- Sprint review and retrospective summary.

All students see the same state live. Only the active participant can:

- Select the story for the turn.
- Roll dice.
- Draw opportunity card.
- Apply card effects.
- Apply saved solutions.
- End the turn.

## Instructor UX

The instructor dashboard includes:

- Session status.
- Team cards showing team name, connected participants, active player, sprint, day, completed stories, blocked stories, points, and latest event.
- Global pause/resume.
- Reset session.
- Reset individual team.
- Team detail view.

The instructor does not need to micromanage turn progression. Teams run at their own pace.

## Game Rules

### Sprint and Turn Progression

- Each sprint has exactly three days.
- Each day gives every current participant one turn.
- After the last participant acts, the day advances.
- After day three ends, the sprint ends.
- At sprint end, compare planned stories against DONE stories.

### Story Selection

- A player can select a story in TO DO or DOING.
- Selecting from TO DO moves it to DOING.
- A DONE story cannot be selected.
- A story with zero remaining hours cannot be selected for dice work.
- A story with zero hours and active problems stays blocked until solved.

### Dice

- A valid roll uses two six-sided dice.
- Pending team dice bonuses apply to the next dice roll by any participant on the team.
- A bonus is consumed once.

### Opportunity Cards

Opportunity cards include events, problems, and solutions.

- Events apply one-time effects and are then discarded.
- Problems attach to the story the player is working on and block DONE.
- Problems do not block further hour reduction.
- Solutions can resolve matching problems.
- If no matching problem exists, solutions can be saved by the team for later.

### Known Rule Fix: `+4 Next Roll`

The card that adds 4 points to the next roll must not modify the current story immediately after the current dice have already been applied.

Correct behavior:

- Store a pending team bonus of `+4`.
- Apply it to the next dice roll made by the team.
- Consume the bonus after that roll.

## Error Handling and Concurrency

- If a session is paused, the UI disables actions and `game-engine` rejects actions.
- If a participant is not active, actions are rejected.
- If two browsers attempt conflicting actions, compare `state_version`; reject stale writes and refresh from the latest state.
- If a browser reloads, recover the participant from local token.
- If a student changes computers, they can rejoin with their name. Manual duplicate resolution can be added later.
- If the opportunity deck is empty, reshuffle the discard pile. If both are empty, show a clear no-card message and allow turn completion.
- Resetting a team recreates backlog, deck, turn state, score, and sprint history while preserving team membership unless the instructor explicitly resets participants too.

## Testing Strategy

Use TDD for new rules, bug fixes, and refactors. The game logic should be testable without DOM or Supabase.

Required initial tests:

- Reject rolling dice when the selected story has zero remaining hours.
- A story with zero hours and an active problem does not move to DONE.
- A blocked story with remaining hours can still receive hour reductions.
- `+4 next roll` does not change the currently selected story after card draw.
- `+4 next roll` applies to the next team roll, regardless of participant.
- `+4 next roll` is consumed exactly once.
- Non-active participants cannot execute turn actions.
- Paused sessions reject team actions.
- Resetting a team restores initial game state while preserving participants.
- Sprint end calculates planned/committed stories vs DONE stories.
- Card reference includes events, problems, and solutions without exposing deck order.

## Deployment Direction

The first deployable version can be:

- Static frontend hosted on GitHub Pages or Supabase hosting.
- Supabase Free project for Postgres and realtime.
- Public anonymous access controlled by unguessable session/team codes and row-level policies.

The implementation should minimize realtime usage:

- Write only meaningful game actions.
- Store compact team snapshots.
- Subscribe only to the current session/team needed by the page.
- Avoid logging high-frequency UI-only events.

## First-Version Decisions

- Supabase row-level security will allow access through unguessable session, teacher, and team codes. The detailed SQL policy text belongs in the implementation plan.
- The instructor can pause, resume, observe, and reset, but cannot impersonate a student or force a team action in the first version.
- Participant turn order is based on join order in the first version.
- Resetting a team preserves participants by default and resets only game state.
- Visual design will be optimized for classroom facilitation: clear, dense, readable, and calm rather than decorative.
