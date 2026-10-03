const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// The platform signs user-identity tokens with an RSA private key it never
// shares. Containers get only the PUBLIC half, so this app can verify who a
// user is but cannot mint an identity — and neither can any other app.
const JWT_PUBLIC_KEY = (process.env.USERNODE_JWT_PUBLIC_KEY || '')
  .replace(/\\n/g, '\n');

// Tokens are minted for one app: the audience is this app's numeric id, so a
// token issued for a different app is rejected below rather than accepted as
// a valid user.
const APP_AUDIENCE = process.env.USERNODE_APP_ID
  ? 'usernode:app:' + process.env.USERNODE_APP_ID
  : null;

// Paths that stay open without authentication. Add a path here (and add it
// with `app.get`/`app.post` below) if you deliberately want it public.
// Everything else requires a valid platform-issued JWT.
const PUBLIC_API_PATHS = new Set(['/health']);

app.use(express.json());

// The platform's three centrally hosted files — the bridge, the native UI
// kit and the Tailwind runtime — are reachable at these paths on this app's
// OWN origin, so index.html can load them with a RELATIVE path and never
// name the platform's hostname. A hostname baked into an app is what breaks
// every app at once when the platform's domain moves.
//
// In production and on a staging preview the platform's edge answers these
// before the request ever reaches this process (a per-app Ingress rule on
// Kubernetes, the wildcard site's matcher on the docker runtime). This
// handler is what makes the same relative paths work under a plain
// `node server.js`, where there is no edge in front of the app at all.
//
// Registered BEFORE the auth middleware because these three files are
// public: the platform serves them anonymously from any app origin, and a
// login redirect arriving where a <script> was expected is exactly the
// failure a relative path is meant to avoid.
// The platform's origin, at RUNTIME, and ONLY from the variable the platform
// injects. No hostname is written into this file: a baked-in one is what left
// the whole fleet pointing at a domain the platform had moved away from.
// Unset only outside the platform (a plain local `node server.js`) — set
// USERNODE_PLATFORM_ORIGIN there too if you want the hosted assets locally.
const PLATFORM_ORIGIN = (process.env.USERNODE_PLATFORM_ORIGIN || '')
  .replace(/\/+$/, '');

app.get(/^\/usernode-(?:bridge|native|tailwind)\//, async (req, res) => {
  try {
    if (!PLATFORM_ORIGIN) return res.sendStatus(503);
    const upstream = await fetch(PLATFORM_ORIGIN + req.path);
    if (!upstream.ok) return res.sendStatus(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.type(type);
    // max-age=0 with revalidation, never a long TTL: the whole point of
    // central hosting is that a platform-side fix lands on the next load.
    res.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.warn('hosted asset fetch failed: ' + err.message);
    return res.sendStatus(502);
  }
});

// Verify platform-issued JWT if one was passed, then enforce auth on
// anything not explicitly marked public. The iframe adds `?token=…`
// on load; the frontend script forwards the token via `x-usernode-token`
// on subsequent fetches.
app.use((req, res, next) => {
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && JWT_PUBLIC_KEY && APP_AUDIENCE) {
    try {
      // Pin the algorithm, issuer and audience. Without `algorithms` a
      // caller could hand us an HS256 token signed with the public PEM
      // (which every app knows) and forge any user.
      const claims = jwt.verify(token, JWT_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'usernode',
        audience: APP_AUDIENCE,
      });
      // `pur` names what the token is for. Only user-identity tokens
      // authenticate a person here.
      if (claims && claims.pur === 'iframe') req.user = claims;
    } catch {}
  }

  // Static assets (CSS/JS/images) are always served; the API and the HTML
  // shell are gated so direct hits to the staging/prod subdomain don't
  // leak app data to the public internet.
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    if (PUBLIC_API_PATHS.has(req.path)) return next();
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// The template ships no favicon file; index.html carries an inline SVG
// icon instead. Answer 204 here so anything that still probes
// /favicon.ico (older browsers, direct visits) doesn't fall through to
// the auth-gated catch-all and surface a 401 in the console on every
// fresh load.
app.get('/favicon.ico', (_req, res) => res.status(204).end());

const DAY_MS = 24 * 60 * 60 * 1000;

// Staging previews can show a populated screen without touching the
// database: only when opened with ?demo=1 does the list return obviously
// fake plants. Request-time injection, no rows are written, and the flag
// does nothing in production.
const IS_STAGING = process.env.USERNODE_ENV === 'staging';

// The due-watering rule lives here, in one place, so the client only
// renders what this returns:
// - never watered, or at/past the interval → due today;
// - watered less than one day ago → watered recently;
// - otherwise → upcoming, due in N days (N at least 1).
function withStatus(plant) {
  if (!plant.last_watered_at) return { ...plant, status: 'due-today' };
  const days = Math.floor((Date.now() - new Date(plant.last_watered_at).getTime()) / DAY_MS);
  if (days >= plant.water_every_days) return { ...plant, status: 'due-today' };
  if (days < 1) return { ...plant, status: 'watered-recently' };
  return { ...plant, status: 'upcoming', due_in_days: plant.water_every_days - days };
}

// Plant list
app.get('/api/plants', async (req, res) => {
  try {
    if (IS_STAGING && req.query.demo === '1') {
      const now = Date.now();
      return res.json({ plants: [
        // 9 days since a 7-day interval → due today; 10 hours ago →
        // recently; never watered → due today.
        { id: -1, name: 'Staging demo Fern', water_every_days: 7, last_watered_at: new Date(now - 9 * DAY_MS).toISOString() },
        { id: -2, name: 'Staging demo Pothos', water_every_days: 7, last_watered_at: new Date(now - 10 * 60 * 60 * 1000).toISOString() },
        { id: -3, name: 'Staging demo Basil', water_every_days: 7, last_watered_at: null },
      ].map(withStatus) });
    }
    const { rows } = await pool.query(`
      SELECT id, name, water_every_days, last_watered_at
      FROM plants
      WHERE user_id = $1
      ORDER BY name
    `, [req.user.id]);
    res.json({ plants: rows.map(withStatus) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a plant
app.post('/api/plants', async (req, res) => {
  const name = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const interval = req.body && req.body.water_every_days !== undefined
    ? req.body.water_every_days
    : 7;
  if (!name) return res.status(400).json({ error: 'Give the plant a name' });
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    return res.status(400).json({ error: 'Watering interval must be a whole number of days between 1 and 365' });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO plants (user_id, name, water_every_days)
      VALUES ($1, $2, $3)
      RETURNING id, name, water_every_days, last_watered_at
    `, [req.user.id, name, interval]);
    res.json({ plant: withStatus(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark watered
app.post('/api/plants/:id/water', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Plant not found' });
  try {
    const result = await pool.query(`
      UPDATE plants SET last_watered_at = NOW()
      WHERE id = $1 AND user_id = $2
    `, [id, req.user.id]);
    // Not owned or not found get the same answer, so a stranger cannot
    // learn which ids exist.
    if (!result.rowCount) return res.status(404).json({ error: 'Plant not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// HTML shell: serve the app if authenticated. Unauthenticated top-level
// visits (share links pasted into a browser — Sec-Fetch-Dest: document)
// are sent to the platform's chromeless view of this app, where the shell
// embeds it with a real token so the link just works. Every other
// tokenless case (iframe loads with an expired token, old browsers
// without Sec-Fetch-*) gets the "open in Homeroom" landing page instead
// of a redirect, so the platform shell is never loaded INSIDE its own
// app iframe and stray visits still don't reveal the app.
app.get('*', (req, res) => {
  if (!req.user) {
    // Deep-link pass-through (platform #743): carry the visited
    // path+query into the chromeless view so share links land on the
    // shared screen, not Home. The clean platform route stores `path`
    // as one encoded query value so an inner ?, &, or = survives. The
    // shell decodes and validates it as relative-only before use. The
    // character test keeps the
    // value attribute-safe for the landing anchor below — anything
    // unusual falls back to the bare link.
    const deepPath = /^\/[A-Za-z0-9\-._~!$&()*+,;=:@\/%?]*$/.test(req.originalUrl)
      ? '?path=' + encodeURIComponent(req.originalUrl) : '';
    if (PLATFORM_ORIGIN && req.get('sec-fetch-dest') === 'document') {
      return res.redirect(302, PLATFORM_ORIGIN + '/app/plant-pal-1ad9b5/full' + deepPath);
    }
    return res.status(401).send(`<!doctype html><meta charset=utf-8><title>Open in Homeroom</title>
<body style="font-family:system-ui;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="max-width:24rem;padding:2rem;text-align:center">
    <h1 style="font-size:1.25rem;margin:0 0 0.5rem">Open this app inside Homeroom</h1>
    <p style="color:#a1a1aa;font-size:0.9rem;margin:0 0 1.25rem">This page is served via the platform; direct visits aren't authenticated.</p>
    <a href="${PLATFORM_ORIGIN}/app/plant-pal-1ad9b5/full${deepPath}" style="display:inline-block;padding:0.5rem 1rem;background:#7c3aed;color:white;border-radius:0.5rem;text-decoration:none;font-size:0.9rem">Open in Homeroom</a>
  </div>
</body>`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plants (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      water_every_days INTEGER NOT NULL,
      last_watered_at TIMESTAMPTZ
    )
  `);
  const server = app.listen(port, () => console.log(`Listening on :${port}`));
  // Let Envoy retire idle upstream connections at 60s, with a 15s margin.
  server.keepAliveTimeout = 75_000;
}

start().catch(err => { console.error(err); process.exit(1); });
