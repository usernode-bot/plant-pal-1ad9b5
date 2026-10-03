# Plant Pal — notes for Claude Code

This app runs on **Homeroom**. If you're Claude Code
editing this repo, read the platform conventions before making
changes:

**Platform conventions (authoritative, always current):**
https://app.onhomeroom.com/claude.md

Fetch that URL at the start of each session — it's the single source
of truth for platform-wide behavior (auth model, `USERNODE_ENV`,
public/private tables, "don't `git push`", etc.). The hosted copy is
updated in place when platform rules change, so fetching it gives you
today's rules, not a stale snapshot.

When running inside Homeroom's dev-chat, those same conventions are
already injected into your system prompt, so the fetch is a no-op in
that path — but it's the right reflex when someone runs Claude Code
against this repo locally or from another harness.

## Connector permission prompts

This repo ships `.claude/settings.json`, which allows the **read-only**
Homeroom connector calls (`mcp__homeroom__get_*`,
`…__list_*`, `…__whoami`) so they stop prompting one at a time. Everything
that acts — filing a request, opening or advancing a proposal — still asks.
Claude Code applies those rules only after you accept the
workspace trust dialog, which lists them for review. See `.claude/README.md`
for the whole story, including what to do if you are still being prompted
(usually: your connector is registered under a different name than the rules
assume).

## Check that this checkout is current

You may be working in a fork of this app whose `main` is behind the app's
canonical repository, and nothing in the checkout says so: `git fetch origin`
compares the fork with itself. This matters before you **read** code to answer
a question about how the app behaves now, not only before you edit it.

The canonical repository is named in `.claude/homeroom-canonical-repo`. Check against
it, not against `origin`:

```sh
git fetch "$(cat .claude/homeroom-canonical-repo)" main
git merge-base --is-ancestor FETCH_HEAD HEAD && echo current || echo behind
```

`behind` means this checkout does not contain the canonical `main`. To answer
a question, read the canonical code instead (`git show FETCH_HEAD:<path>`,
`git grep <pattern> FETCH_HEAD`). To change code, start from the exact base
commit your Homeroom work order gives, and never merge or rebase onto the
canonical `main` yourself: which commit a change is diffed against decides
what the group votes on. With the Homeroom connector, `get_checkout_status`
answers the same question.

A session-start hook (`.claude/hooks/homeroom-freshness.sh`, see `.claude/README.md`) runs
this check for you and tells you when you are behind. It is silent offline, so
its silence is not proof the checkout is current. Inside Homeroom's dev-chat
the platform fixes the base commit, and none of this applies.

## Starter template (replaced)

The starter template's screen — the starter notice, the "What's already
working" card and the Press! example (its demo markup, its `/api/press`
and `/api/leaderboard` routes, and the `presses` table bootstrap) — was
removed when the app's first real feature was built. Do not build it back.

What stays from the template, through any rewrite, because it is
platform infrastructure rather than template content:

- the `usernode-dev-console@1` forwarder `<script>`,
- the bridge `<script>`,
- the theme `<script>` right after the bridge tag, which sets a `dark`
  class on `<html>`, and
- the precompiled `/tailwind.css` link.

The design kit is not placeholder either: build the real app with it, and
keep "## Design" below current.

The screen keeps a light and a dark look that follow the viewer's Homeroom
theme, switching live when they change it. Give everything you build both
looks (the design kit's colour tokens carry both), unless one fixed look is
the point of this app, like a game's own scene; then say so under "## Design"
below. Unless a request asks for one, add no theme picker: the viewer's
Homeroom setting is the control. "The platform's light/dark theme inside the
app frame" in the platform conventions has the details.

If a rule below this line conflicts with the hosted conventions, the
hosted conventions win. This file is **app-specific** — write down
things about *this* app that belong in the repo: product intent,
data-model quirks, style preferences, opt-in policies (e.g. which
tables you've marked private), etc.

---

## About Plant Pal

Track watering schedules for your houseplants. Each plant gets a name and
its own watering interval in days, and the screen answers "which plants do
I water today?" at a glance: a "Needs water today" group on top, with a
"Mark watered" button per plant, and an "All plants" list below. Marking a
plant watered restarts its schedule from now. Each plant also shows the
weekday it was last watered. This version keeps it small: no photos, no
species database, no care reminders or notifications, and plants can be
added, watered and deleted (no rename or edit).

## Design

- **Palette:** accent basil green — light look: deep basil `21 128 61`
  with white `--on-accent`; dark look: brighter leaf green `74 222 128`
  with a dark green `--on-accent`. Red stays reserved for errors. The
  neutrals are the warm stone greys the template shipped (ground,
  surface, raised, line, muted).
- **Signature element:** a per-plant water-drop status — a small drop
  icon beside each plant that reads **Due today** (drop filled, accent
  colour), **Due in N days** (drop outlined, muted) or **Watered
  recently** (drop with a check). No other screen element carries the
  drop shape.
- **Type scale:** `text-title`, `text-heading`, `text-body`, `text-small`
  _(change their sizes in `tailwind.config.js` if you must, not their number)_
- **Words the screen uses:** "Plant Pal", "Needs water today", "All
  plants", "Mark watered", "Due today", "Due in N days", "Watered
  recently", "Watered today", "Watered <weekday>", "Never watered",
  "Delete", "Confirm delete", "Add plant", "Plant name", "Watering
  interval", "No plants yet". Reuse them for the same things rather than
  introducing synonyms.

The kit is in `styles/tailwind-input.css`: colour tokens with a light and
a dark value (named in `tailwind.config.js`), and a few components
(`btn-primary`, `btn-secondary`, `field`, `list` and `list-row`,
`card`, `section-label`, `skeleton`, `state-empty`, `state-error`).
Re-theme by changing the token values there, keeping every text pair at
4.5:1 or more in both looks.

- Colour comes only from the tokens (`bg-ground`, `bg-surface`,
  `text-fg`, `text-muted`, `border-line`, `bg-accent` with
  `text-on-accent`, ...): never a raw hex value or a stock palette class.
- Tap targets are at least 44 px; the buttons and fields already are.
- Every screen that loads data has honest loading, empty and error states.
  Never show the empty state while loading or after a failure; an error says
  what failed, what still works, and offers Retry.
- No cards in cards, no uppercase eyebrows, no emoji as icons.

## App-specific conventions

- Watering due-ness is computed server-side, in `withStatus` in
  `server.js`, so the rule lives in one place; the client only renders
  what it returns.
- Staging demo plants are request-time injection on `GET /api/plants?demo=1`
  (behind `IS_STAGING`), never written rows.
- Avoid adding new npm dependencies.
