/**
 * Rwaq Loyalty Card backend.
 *
 * Two layers of API live here:
 *
 *   1. PUBLIC WEBSITE API
 *      Used by the LoyaltyDemo React component on /rawa2/. The site card
 *      reads + writes stamps without auth (it's a demo).
 *
 *      GET  /api/rawa2/wallet/:serial          → full card state
 *      POST /api/rawa2/wallet/:serial/scan     → +1 stamp
 *      POST /api/rawa2/wallet/:serial/reset    → back to 0
 *      GET  /api/rawa2/wallet/_health          → ops probe
 *
 *   2. APPLE WALLET WEB SERVICE (PassKit protocol)
 *      The endpoints iOS Wallet hits to sync passes. Implemented to spec
 *      so once a re-signed pkpass with `webServiceURL` is deployed,
 *      iOS will start calling these routes automatically.
 *
 *      POST   /api/rawa2/wallet/v1/devices/:deviceLibraryID/registrations/:passTypeID/:serial
 *      DELETE /api/rawa2/wallet/v1/devices/:deviceLibraryID/registrations/:passTypeID/:serial
 *      GET    /api/rawa2/wallet/v1/devices/:deviceLibraryID/registrations/:passTypeID
 *      GET    /api/rawa2/wallet/v1/passes/:passTypeID/:serial         (returns signed pkpass)
 *      POST   /api/rawa2/wallet/v1/log
 *
 * When a stamp is added via /scan, the backend looks up every registered
 * iOS device for that pass serial and queues an APNs silent push. iOS
 * receives the push and immediately calls GET /v1/passes/... to fetch
 * the new pass; we generate a fresh pass.json server-side, sign it with
 * the Apple Pass Type cert, and return the signed .pkpass.
 *
 * CONFIGURATION TO TURN REAL WALLET SYNC ON
 *   WALLET_PASS_P12_PATH     — absolute path to the Pass-Type .p12 cert
 *   WALLET_PASS_P12_PASSWORD — password that unlocks the .p12
 *   WALLET_PASS_WWDR_PATH    — absolute path to Apple WWDR intermediate cert (PEM)
 *   WALLET_PASS_APNS_BUNDLE  — the pass type identifier ("pass.coffee.com")
 *
 *   When any of these is missing, the Wallet Web Service routes still
 *   exist + answer registration/unregistration calls so iOS doesn't
 *   error, but pass generation falls back to a 503 and APNs pushes are
 *   logged-only (no actual push sent). This keeps everything safe and
 *   debuggable until the cert lands.
 *
 * STATE STORAGE
 *   In-memory Maps. Loses everything on Node restart. Trade-off chosen
 *   for demo speed; swap for MySQL tables if persistence matters.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = (() => {
  try { return require('./workspace-logger'); }
  catch (_) { return { info: console.log, warn: console.warn, error: console.error }; }
})();

// ─── Config ────────────────────────────────────────────────────────────
const GOAL = 10;
const PASS_TYPE_ID = process.env.WALLET_PASS_APNS_BUNDLE || 'pass.coffee.com';

const P12_PATH = (process.env.WALLET_PASS_P12_PATH || '').trim();
const P12_PASSWORD = process.env.WALLET_PASS_P12_PASSWORD || '';
const WWDR_PATH = (process.env.WALLET_PASS_WWDR_PATH || '').trim();
const PASS_TEMPLATE_DIR = path.join(__dirname, 'public', 'rawa2');

const CERT_AVAILABLE = !!(P12_PATH && P12_PASSWORD && WWDR_PATH &&
  fs.existsSync(P12_PATH) && fs.existsSync(WWDR_PATH));

// ─── In-memory state ───────────────────────────────────────────────────
// CARDS: serial → card state object
const CARDS = new Map();
// DEVICES: deviceLibraryID → { pushToken, lastSeen }
const DEVICES = new Map();
// REGISTRATIONS: serial → Set<deviceLibraryID>
const REGISTRATIONS = new Map();
// PASS_TOKENS: serial → authenticationToken (random per pass)
const PASS_TOKENS = new Map();

function nowIso() { return new Date().toISOString(); }

function authTokenFor(serial) {
  if (!PASS_TOKENS.has(serial)) {
    PASS_TOKENS.set(serial, crypto.randomBytes(20).toString('hex'));
  }
  return PASS_TOKENS.get(serial);
}

function makeDefault(serial) {
  return {
    serial,
    cardholder: 'Rwaq Member',
    stamps: 0,
    goal: GOAL,
    tier: 'Bronze',
    memberSince: 2025,
    lastScanAt: null,
    updatedAt: nowIso(),
    // Last-Modified tag used by /v1/devices/... delta queries
    lastUpdateTag: String(Date.now()),
  };
}

function tierForStamps(n) {
  if (n >= 8) return 'Gold';
  if (n >= 4) return 'Silver';
  return 'Bronze';
}

function decorate(state) {
  const remaining = Math.max(0, GOAL - state.stamps);
  return {
    ...state,
    tier: tierForStamps(state.stamps),
    nextReward: state.stamps >= GOAL
      ? 'Free drink ready!'
      : `Free drink in ${remaining} stamp${remaining === 1 ? '' : 's'}`,
    fullyEarned: state.stamps >= GOAL,
  };
}

function getOrCreate(serial) {
  const key = String(serial || '').trim();
  if (!key) return null;
  if (!CARDS.has(key)) CARDS.set(key, makeDefault(key));
  return CARDS.get(key);
}

function touchUpdateTag(state) {
  state.lastUpdateTag = String(Date.now());
  state.updatedAt = nowIso();
}

// ─── Stub: pass signing ───────────────────────────────────────────────
// Generates a signed pkpass buffer using the Apple Pass Type cert. When
// the cert isn't configured this just returns null and the route 503s.
async function generateSignedPass(card) {
  if (!CERT_AVAILABLE) return null;
  // TODO: implement using node-forge or openssl smime:
  //  1. Read pass.json template from PASS_TEMPLATE_DIR
  //  2. Update primaryFields / headerFields / secondaryFields with card state
  //  3. Write to a temp dir along with all pass images
  //  4. Compute SHA-1 of every file → manifest.json
  //  5. PKCS#7 detached-sign manifest.json with P12 cert (+ WWDR chain)
  //  6. Zip everything into a pkpass buffer
  //  7. Return the buffer
  logger.warn('[Wallet] generateSignedPass called but signing stub is not implemented yet');
  return null;
}

// ─── Stub: APNs push ──────────────────────────────────────────────────
// Sends a silent push to iOS telling Wallet "this pass changed, fetch it".
async function sendApnsPush(pushToken) {
  if (!CERT_AVAILABLE) {
    logger.info(`[Wallet] Would push to ${pushToken.slice(0, 12)}… (cert not configured)`);
    return false;
  }
  // TODO: HTTP/2 to api.push.apple.com with the pass cert as client auth.
  // Payload: { aps: {} }  (empty — that's how Wallet expects it)
  logger.warn('[Wallet] sendApnsPush stub — not actually pushing yet');
  return false;
}

async function pushToRegisteredDevices(serial) {
  const devs = REGISTRATIONS.get(serial);
  if (!devs || devs.size === 0) {
    logger.info(`[Wallet] No devices registered for ${serial}, skipping push`);
    return;
  }
  let pushed = 0;
  for (const deviceID of devs) {
    const info = DEVICES.get(deviceID);
    if (!info || !info.pushToken) continue;
    const ok = await sendApnsPush(info.pushToken);
    if (ok) pushed += 1;
  }
  logger.info(`[Wallet] Push attempted for serial=${serial} devices=${devs.size} succeeded=${pushed}`);
}

// ─── ApplePass auth middleware ────────────────────────────────────────
function requireApplePass(req, res, next) {
  const auth = String(req.headers.authorization || '').trim();
  const m = /^ApplePass\s+(.+)$/.exec(auth);
  if (!m) return res.status(401).end();
  const token = m[1];
  const serial = req.params.serialNumber;
  if (!serial) return res.status(401).end();
  if (authTokenFor(serial) !== token) return res.status(401).end();
  next();
}

// ─── Route registration ───────────────────────────────────────────────
function registerRawa2WalletRoutes(app) {

  // ═════════════════════════════════════════════════════════════════════
  //  WEBSITE-FACING DEMO API (no auth)
  // ═════════════════════════════════════════════════════════════════════

  app.get('/api/rawa2/wallet/_health', (req, res) => {
    res.json({
      ok: true,
      cards: CARDS.size,
      devices: DEVICES.size,
      registrations: REGISTRATIONS.size,
      certConfigured: CERT_AVAILABLE,
      passTypeId: PASS_TYPE_ID,
      goal: GOAL,
      defaultSerial: 'RWQ-00001',
    });
  });

  app.get('/api/rawa2/wallet/:serial', (req, res) => {
    const state = getOrCreate(req.params.serial);
    if (!state) return res.status(400).json({ success: false, error: 'invalid serial' });
    res.json({ success: true, card: decorate(state) });
  });

  app.post('/api/rawa2/wallet/:serial/scan', async (req, res) => {
    const state = getOrCreate(req.params.serial);
    if (!state) return res.status(400).json({ success: false, error: 'invalid serial' });
    const before = state.stamps;
    state.stamps = Math.min(GOAL, state.stamps + 1);
    state.lastScanAt = nowIso();
    touchUpdateTag(state);
    // Tell every registered iOS device that this pass has changed.
    pushToRegisteredDevices(req.params.serial).catch((e) =>
      logger.error('[Wallet] push failed:', e.message)
    );
    res.json({
      success: true,
      card: decorate(state),
      changed: state.stamps !== before,
      message: state.stamps === GOAL ? '🎉 Free drink earned!'
            : state.stamps !== before ? `Stamp added (${state.stamps}/${GOAL})`
            : `Already at goal (${state.stamps}/${GOAL})`,
      pushedToDevices: (REGISTRATIONS.get(req.params.serial) || new Set()).size,
    });
  });

  app.post('/api/rawa2/wallet/:serial/reset', async (req, res) => {
    const state = getOrCreate(req.params.serial);
    if (!state) return res.status(400).json({ success: false, error: 'invalid serial' });
    state.stamps = 0;
    state.lastScanAt = null;
    touchUpdateTag(state);
    pushToRegisteredDevices(req.params.serial).catch(() => {});
    res.json({ success: true, card: decorate(state) });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  APPLE WALLET WEB SERVICE (PassKit protocol)
  //  iOS hits these directly when the user adds/removes a pass with a
  //  webServiceURL pointing at us.
  // ═════════════════════════════════════════════════════════════════════

  // Register a device for pass updates
  app.post('/api/rawa2/wallet/v1/devices/:deviceLibraryID/registrations/:passTypeID/:serialNumber',
    requireApplePass,
    (req, res) => {
      const { deviceLibraryID, passTypeID, serialNumber } = req.params;
      if (passTypeID !== PASS_TYPE_ID) {
        logger.warn(`[Wallet] Register rejected: passTypeID mismatch ${passTypeID} vs ${PASS_TYPE_ID}`);
        return res.status(400).end();
      }
      const pushToken = req.body && req.body.pushToken;
      if (!pushToken) return res.status(400).end();

      const wasRegistered = (REGISTRATIONS.get(serialNumber) || new Set()).has(deviceLibraryID);

      DEVICES.set(deviceLibraryID, { pushToken, lastSeen: nowIso() });
      if (!REGISTRATIONS.has(serialNumber)) REGISTRATIONS.set(serialNumber, new Set());
      REGISTRATIONS.get(serialNumber).add(deviceLibraryID);

      // Ensure the card exists so subsequent updates can find it
      getOrCreate(serialNumber);

      logger.info(`[Wallet] Device ${deviceLibraryID.slice(0, 12)}… registered for ${serialNumber} (new=${!wasRegistered})`);
      res.status(wasRegistered ? 200 : 201).end();
    }
  );

  // Unregister
  app.delete('/api/rawa2/wallet/v1/devices/:deviceLibraryID/registrations/:passTypeID/:serialNumber',
    requireApplePass,
    (req, res) => {
      const { deviceLibraryID, serialNumber } = req.params;
      const set = REGISTRATIONS.get(serialNumber);
      if (set) {
        set.delete(deviceLibraryID);
        if (set.size === 0) REGISTRATIONS.delete(serialNumber);
      }
      logger.info(`[Wallet] Device ${deviceLibraryID.slice(0, 12)}… unregistered from ${serialNumber}`);
      res.status(200).end();
    }
  );

  // List passes updated for a device (delta query)
  app.get('/api/rawa2/wallet/v1/devices/:deviceLibraryID/registrations/:passTypeID',
    (req, res) => {
      const { deviceLibraryID } = req.params;
      const updatedSince = String(req.query.passesUpdatedSince || '');
      const serials = [];
      let lastUpdated = 0;
      for (const [serial, devices] of REGISTRATIONS.entries()) {
        if (!devices.has(deviceLibraryID)) continue;
        const card = CARDS.get(serial);
        if (!card) continue;
        const tag = Number(card.lastUpdateTag) || 0;
        if (!updatedSince || tag > Number(updatedSince)) {
          serials.push(serial);
          if (tag > lastUpdated) lastUpdated = tag;
        }
      }
      if (serials.length === 0) return res.status(204).end();
      res.json({ serialNumbers: serials, lastUpdated: String(lastUpdated) });
    }
  );

  // Get latest signed pass
  app.get('/api/rawa2/wallet/v1/passes/:passTypeID/:serialNumber',
    requireApplePass,
    async (req, res) => {
      const { serialNumber } = req.params;
      const state = getOrCreate(serialNumber);
      if (!state) return res.status(404).end();

      if (!CERT_AVAILABLE) {
        logger.warn('[Wallet] Pass requested but P12 cert not configured — returning 503');
        return res.status(503).json({
          error: 'Pass signing is not configured on this server',
          fix: 'Set WALLET_PASS_P12_PATH + WALLET_PASS_P12_PASSWORD + WALLET_PASS_WWDR_PATH env vars',
        });
      }

      const ifModifiedSince = req.headers['if-modified-since'];
      const lastMod = new Date(state.updatedAt).toUTCString();
      if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= new Date(state.updatedAt).getTime()) {
        return res.status(304).end();
      }

      const buf = await generateSignedPass(decorate(state));
      if (!buf) {
        return res.status(500).json({ error: 'Pass generation failed' });
      }
      res.set('Content-Type', 'application/vnd.apple.pkpass');
      res.set('Last-Modified', lastMod);
      res.send(buf);
    }
  );

  // iOS Wallet error logs
  app.post('/api/rawa2/wallet/v1/log', (req, res) => {
    const logs = (req.body && req.body.logs) || [];
    logs.forEach((line) => logger.warn(`[Wallet device log] ${line}`));
    res.status(200).end();
  });

  // ─── Admin / debug ────────────────────────────────────────────────
  app.get('/api/rawa2/wallet/_debug/state', (req, res) => {
    res.json({
      passTypeId: PASS_TYPE_ID,
      certConfigured: CERT_AVAILABLE,
      cards: Array.from(CARDS.entries()).map(([k, v]) => ({ ...decorate(v), token: authTokenFor(k) })),
      devices: Array.from(DEVICES.entries()).map(([id, d]) => ({
        deviceLibraryID: id, pushToken: d.pushToken.slice(0, 16) + '…', lastSeen: d.lastSeen,
      })),
      registrations: Array.from(REGISTRATIONS.entries()).map(([s, set]) => ({
        serial: s, deviceCount: set.size,
      })),
    });
  });

  // ─── Boot log ─────────────────────────────────────────────────────
  if (CERT_AVAILABLE) {
    logger.info(`[Wallet] Apple Wallet Web Service registered for ${PASS_TYPE_ID} (cert: configured)`);
  } else {
    logger.warn(`[Wallet] Apple Wallet Web Service registered for ${PASS_TYPE_ID} (cert: MISSING — pass generation will 503)`);
  }
}

module.exports = {
  registerRawa2WalletRoutes,
  // Exported for the regenerate-pass.js helper script
  PASS_TYPE_ID,
  authTokenFor,
};
