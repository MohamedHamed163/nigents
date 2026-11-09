# Rwaq Loyalty Wallet — Sync Setup

> How to turn real Apple Wallet updates on for the Rwaq Loyalty pass.
> The backend is already built. This document covers the one remaining
> piece — the Apple Developer credentials — and the one-time pkpass
> re-issue that has to happen before sync works.

## TL;DR

The Wallet pass currently in users' phones **cannot sync** because the
original pkpass was shipped without a `webServiceURL`. iOS Wallet only
contacts our backend if the pass tells it to.

To enable real-time sync we need:

1. **Apple Pass-Type certificate** (`.p12`) + its password, plus the
   **Apple WWDR intermediate certificate** (PEM) — both from the Apple
   Developer portal under team `97DNR5Y3Y5`.
2. A **re-issued pkpass** with `webServiceURL` and `authenticationToken`
   added to `pass.json`, then signed with the cert above.
3. Users **delete the current pass and add the new one** (one-time pain).

Once those three steps are done, every tap on **MARK AS SCANNED**
flows through to every user's lock-screen Wallet card in seconds.

---

## What's already built

`src/dashboard/rawa2-wallet-api.js` implements the full Apple Wallet
Web Service protocol. Routes that iOS Wallet calls:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/rawa2/wallet/v1/devices/{deviceLibraryID}/registrations/{passTypeID}/{serial}` | iOS registers a device + push token when a user adds the pass |
| `DELETE` | same URL above | iOS unregisters when user removes the pass |
| `GET` | `/api/rawa2/wallet/v1/devices/{deviceLibraryID}/registrations/{passTypeID}` | iOS asks "which of my passes have updated?" |
| `GET` | `/api/rawa2/wallet/v1/passes/{passTypeID}/{serial}` | iOS fetches the latest signed pkpass |
| `POST` | `/api/rawa2/wallet/v1/log` | iOS sends error logs (we record them) |

When the website's **MARK AS SCANNED** button POSTs to `/scan`, the
backend:

1. Increments stamps in memory
2. Looks up every iOS device registered for that pass serial
3. Sends an empty APNs push to each device (the "ping" telling Wallet
   to fetch the latest pass)

iOS receives the push → GETs `/v1/passes/...` → backend regenerates
`pass.json` with the new stamp count, signs the manifest with the cert,
returns the signed pkpass → iOS updates the card silently.

---

## What's still stubbed (waiting on the cert)

Two helper functions in `rawa2-wallet-api.js` are stubs that will be
filled in once the cert is available:

- `generateSignedPass(card)` — regenerates and signs a fresh pkpass
- `sendApnsPush(pushToken)` — actually delivers the push to APNs

Both stubs gracefully detect the missing cert and return false/null
instead of crashing. So the registration endpoints already work; only
the pass-generation + push-delivery steps are inert.

---

## Step 1 — Get the credentials from Apple

The Apple Developer team that signed the original pass (`97DNR5Y3Y5`)
must export these:

### a) Pass-Type signing certificate (`.p12`)
1. Sign in at https://developer.apple.com → Certificates, IDs & Profiles
2. Open **Identifiers** → **Pass Type IDs** → `pass.coffee.com`
3. Generate (or download the existing) signing certificate
4. Export it from Keychain Access as `.p12` with a password

### b) Apple WWDR intermediate
This is public. Download from https://www.apple.com/certificateauthority/
(look for "Worldwide Developer Relations - G4" or similar) and save as
`AppleWWDRCAG4.pem`.

### c) The same cert is also valid for APNs
Apple uses the Pass Type cert for both signing the pass and authenticating
push notifications. You don't need a separate APNs cert.

---

## Step 2 — Drop the credentials on the server

SSH into the EC2 box and place the files at any path you like:

```
/home/ubuntu/secrets/rwaq-pass.p12
/home/ubuntu/secrets/AppleWWDRCAG4.pem
```

Add four env vars to the Node process (typically in `.env` or the
systemd service file):

```bash
WALLET_PASS_P12_PATH=/home/ubuntu/secrets/rwaq-pass.p12
WALLET_PASS_P12_PASSWORD=your-p12-password-here
WALLET_PASS_WWDR_PATH=/home/ubuntu/secrets/AppleWWDRCAG4.pem
WALLET_PASS_APNS_BUNDLE=pass.coffee.com
```

Restart the Node process. You should see this in the logs:

```
[Wallet] Apple Wallet Web Service registered for pass.coffee.com (cert: configured)
```

Confirm via the health endpoint:

```bash
curl https://nigents.com/api/rawa2/wallet/_health
# certConfigured: true
```

---

## Step 3 — Re-issue the pkpass

The deployed `RwaqLoyalty.pkpass` has no `webServiceURL`. We need to
re-issue it with these added to `pass.json`:

```json
{
  ...existing fields...,
  "webServiceURL": "https://nigents.com/api/rawa2/wallet/",
  "authenticationToken": "<a unique random string per pass>"
}
```

You can either:

- **A. Regenerate manually** with whatever tool the original creator
  used (Pass Builder, pkpass-cli, your own script). Add the two fields,
  re-sign with the `.p12`, drop the new file at
  `src/dashboard/public/rawa2/RwaqLoyalty.pkpass`.

- **B. Add a regenerator route** to the backend. Once the cert is
  configured, the backend can produce a base `RwaqLoyalty.pkpass` on
  demand. We can build that route next — it's small.

The `authenticationToken` is a per-pass secret that iOS sends in the
`Authorization: ApplePass <token>` header on every call. Our backend
generates one per serial automatically and stores it in `PASS_TOKENS`.
You can pull the right token to embed in `pass.json` from:

```bash
curl https://nigents.com/api/rawa2/wallet/_debug/state | jq '.cards[0].token'
```

---

## Step 4 — Users add the new pass

Anyone who currently has the old `RwaqLoyalty.pkpass` in their Wallet
needs to:

1. Open Wallet → tap the Rwaq pass → tap (•••) → **Remove Pass**
2. Go to https://nigents.com/rawa2/ → tap **Add to Apple Wallet**
3. The new pass downloads. iOS registers the device with our backend
   silently. You'll see the registration arrive in the server logs:

```
[Wallet] Device 47f3a9d1a8d2… registered for RWQ-00001 (new=true)
```

From then on, every scan on the website updates the card on the phone
automatically.

---

## Test flow once everything is configured

1. Add the new pass to iPhone Wallet
2. Open https://nigents.com/rawa2/#loyalty-demo on a laptop
3. Tap **MARK AS SCANNED**
4. Within ~5 seconds, look at the phone — the stamp count updates on
   the Wallet card lock-screen widget
5. Open the pass in Wallet — the strip image now shows the new count

---

## State & persistence (important caveat)

The backend stores card state, device registrations, and per-pass auth
tokens **in memory**. When the Node process restarts (every deploy),
all of that is lost. Real users would get `401 Unauthorized` from iOS
the next time Wallet asks for an update, because their `authenticationToken`
no longer matches what the server knows.

Before going to real production:

- Move `CARDS`, `DEVICES`, `REGISTRATIONS`, `PASS_TOKENS` to MySQL
- Generate the `authenticationToken` deterministically (e.g., HMAC of
  serial with a long-lived server secret) so token survival across
  restarts is automatic

This is a 1-hour change once you decide to ship for real.

---

## Why not skip the cert?

Apple Wallet refuses unsigned passes. There is no escape hatch. The
`.p12` is the only key that lets a server claim "this is a legitimate
update for `pass.coffee.com`." Without it, anything we generate is
rejected by iOS on the device.

If the original team is unwilling/unable to share the cert, the only
alternative is to register a fresh Pass Type ID under whoever's Apple
Developer account *will* operate the loyalty programme — and re-launch
the pass under that new identifier.
