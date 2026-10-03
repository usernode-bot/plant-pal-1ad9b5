# Plant Pal

Track watering schedules for your houseplants, so they stop getting
forgotten. Each plant gets a name and its own watering interval in days,
and the screen answers "which plants do I water today?" at a glance.

## What the screen shows

- **Needs water today** — every plant whose watering day has arrived
  (or that has never been watered), each with a **Mark watered** button.
- **All plants** — the rest, each with its status: **Due in N days** or
  **Watered recently**.
- **Add plant** — an inline form (name + watering interval in days,
  defaulting to 7).

Marking a plant watered sets its last-watered time to now and moves it out
of the today group. The due rule is computed on the server, in one place.

## API

| Route | What it does |
| --- | --- |
| `GET /api/plants` | Your plants, ordered by name, each with a server-computed `status` (`due-today`, `watered-recently`, or `upcoming` with `due_in_days`). |
| `POST /api/plants` | Add a plant: `{ name, water_every_days }`. Name required; interval an integer from 1 to 365, defaulting to 7. |
| `POST /api/plants/:id/water` | Mark a plant watered (sets `last_watered_at` to now). 404 for a plant that is not yours or does not exist. |

## Data

One table, `plants`: `id`, `user_id`, `name`, `water_every_days`,
`last_watered_at` (null until first watered). Watering history beyond the
last time is not kept in this version.

## Platform

Sign-in (RS256 JWT verification), the Postgres database, the centrally
hosted bridge and UI kit, and the light/dark theming that follows the
viewer's Homeroom setting all come from the platform. Styling is Tailwind,
precompiled by `npm run build` during image creation with either
Kubernetes/Paketo or standalone Docker, in a light and a dark look.

On staging previews, `GET /api/plants?demo=1` returns three obviously fake
demo plants ("Staging demo Fern" and friends) so the populated screen can
be reviewed without touching the database. The flag does nothing in
production.

## Working on the repo

Start with `CLAUDE.md`, which carries the app-specific notes and points
at the platform rules: https://app.onhomeroom.com/claude.md
