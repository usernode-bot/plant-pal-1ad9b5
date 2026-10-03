# Plant Pal

Track watering schedules for your houseplants: list your plants, see when
each one was last watered, and see which ones need water today. One screen,
one action that matters — **Mark watered**.

- **Needs water today** — every plant whose watering day has arrived, with a
  **Mark watered** button right on the row.
- **All plants** — your whole list, each plant with a water-drop status
  (Due today, Due in N days, Watered recently).
- **Add plant** — a name and a watering interval in days (default 7).

Your plants belong to you: you see and change only your own list.

## How it works

- **Sign-in** — the server verifies the platform-issued user token (an
  RS256 JWT) on every API request, so the app already knows who is using
  it. No accounts to build.
- **Database** — the app's own private Postgres database; plants live in a
  `plants` table, one row per plant.
- **API** — `GET /api/plants`, `POST /api/plants`, `POST /api/plants/:id/water`.
- **Styling** — Tailwind CSS, precompiled by `npm run build` during image
  creation, in a light and a dark look that follow the viewer's Homeroom
  theme.

In staging previews, `/?demo=1` shows four fake "Staging demo …" plants so
the populated screen can be seen; the plain screen shows your real (or
empty) list.
