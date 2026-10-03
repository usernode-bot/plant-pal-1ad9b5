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

The starter template screen (the Press! demo, `/api/press`, `/api/leaderboard`
and the `presses` table) was replaced by the app's first real screen. The
platform infrastructure that must survive any future rewrite of
`public/index.html` is still there: the `usernode-dev-console@1` forwarder
`<script>`, the `/tailwind.css` link, the bridge `<script>`, and the theme
`<script>` right after the bridge tag, which sets a `dark` class on `<html>`
from the viewer's Homeroom theme. Give everything you build both looks (the
design kit's colour tokens carry both); unless a request asks for one, add
no theme picker — the viewer's Homeroom setting is the control. "The
platform's light/dark theme inside the app frame" in the platform
conventions has the details.

If a rule below this line conflicts with the hosted conventions, the
hosted conventions win. This file is **app-specific** — write down
things about *this* app that belong in the repo: product intent,
data-model quirks, style preferences, opt-in policies (e.g. which
tables you've marked private), etc.

---

## About Plant Pal

Track watering schedules for your houseplants. The user keeps a list of
their plants with a per-plant watering interval in days, sees when each was
last watered, and waters the ones that are due today from a single screen.
The one primary action is **Mark watered**. First version: add, list and
water — no editing, deleting, reminders or photos yet.

## Design

This app's look. Every later change follows it, and updates it when a
request changes the look on purpose.

- **Palette:** basil green accent on the warm stone neutrals the starter
  kit ships (ground, surface, raised, fg, muted, line untouched). Light
  accent `21 128 61` (deep basil, white text on it), dark accent
  `134 239 172` (bright leaf) with dark text `20 83 45`. No second colour;
  danger untouched.
- **Signature element:** the water-drop glyph on every plant row — drawn in
  the accent when the plant is due, muted when it is not, so the state
  reads before the words do.
- **Type scale:** `text-title`, `text-heading`, `text-body`, `text-small`
  (unchanged sizes in `tailwind.config.js`).
- The screen is a normal app screen, not a scene: it renders in both the
  light and the dark look from the same tokens; no fixed theme, no theme
  picker.

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
- Seed obviously fake staging demo data so the populated screen can be seen
  ("Staging mock data" in the platform conventions).
- No cards in cards, no uppercase eyebrows, no emoji as icons.

## App-specific conventions

- Plant rows are strictly per-user: every query on `plants` filters on
  `user_id = req.user.id`; one viewer can never read or water another's
  plant (a foreign id answers 404, not 403).
- Watering state is computed client-side from `lastWateredAt` and
  `wateringIntervalDays` against the viewer's local day; the server stores
  only the timestamp.
- The `plants` table stays public (no `staging:private` comment): it holds
  plant names and watering dates, nothing sensitive beyond that.
- Staging demo rows are owned by fake identity `user_id = -1`; previews
  see a populated screen via `/?demo=1` (read-only injection, staging only).
