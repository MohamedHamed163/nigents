# Upload Size Limits — Deployment Cheatsheet

Workspace media uploads (screenshots / videos), Excel imports, and large issue
bodies all need bigger limits than the platform defaults. The full stack:

```
Browser → Proxy (nginx / Apache) → Node Express → Multer → Disk
            ↑                          ↑           ↑
            #1                         #2          #3
```

If you see a **413 Request Entity Too Large**, fix layer #1 (the proxy).
If you see a **PayloadTooLargeError** in the Node logs, fix layer #2.
If you see a **MulterError: File too large** in the JSON response, fix layer #3.

---

## ✅ #2 + #3 — already configured in this repo

| Limit | Where | Value |
|---|---|---|
| Express JSON body | `server.js` — `express.json({ limit: '25mb' })` | **25 MB** |
| Express URL-encoded body | `server.js` — `express.urlencoded({ limit: '25mb' })` | **25 MB** |
| Issue media file | `workspace-issue-media.js` — `MAX_FILE_BYTES` | **25 MB / file** × 12 files |
| Excel import file | `workspace-excel-import.js` — `MAX_FILE_BYTES` | **20 MB** |
| Build upload (.apk/.ipa/.dmg) | `workspace-builds-api.js` — `MAX_BUILD_SIZE` | **200 MB** |
| Client-side auto-compress | `workspace-multi-app.js` — images > 600 KB resized to 2000 px JPEG @ 0.85 | **prevents most 413s at the source** |

Restart the Node process after pulling these changes — limits are read on boot.

---

## #1 — Configure your proxy / web server

Pick the section that matches your deploy.

### 🐧 nginx (most VPS / Docker / Coolify setups)

Add inside the `server { ... }` or `location / { ... }` block that proxies
to nigents:

```nginx
# Allow up to 50 MB request bodies — covers media + Excel + form uploads
client_max_body_size 50M;

# Prevent slow uploads from timing out
client_body_timeout 120s;
client_body_buffer_size 1m;
proxy_request_buffering off;   # stream uploads, don't buffer them all in RAM
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

If you have nginx in front of nigents via Coolify / Caddy / Traefik, the
config flag is named differently — see your platform's "max body size" or
"request buffer size" docs.

Reload nginx after editing:
```sh
sudo nginx -t && sudo nginx -s reload
```

### 🍎 Apache (cPanel-style shared hosting)

In the `public_html/.htaccess` file (or whichever directory acts as the proxy
target), add:

```apache
# Allow 50 MB upload bodies
LimitRequestBody 52428800

# Increase proxy buffer for large multipart bodies (mod_proxy reverse)
<IfModule mod_proxy.c>
  ProxyTimeout 300
  ProxyReceiveBufferSize 65536
</IfModule>
```

cPanel's "PHP Tweak Settings" UI also has `upload_max_filesize` and
`post_max_size` — set both to **50M** if any PHP layer sits in front.

### ☁️ Cloudflare (if used in front)

Free plan caps at **100 MB** body size — already enough for our limits.
No config needed unless you're on a custom rule that rejects large bodies.

### 🐳 Docker / docker-compose (your existing setup)

The repo's `docker-compose.yml` doesn't include nginx — Express is exposed
directly on port 4000. If you've added nginx in front, the config above goes
in `nginx.conf` mounted into the container, NOT in `docker-compose.yml`.

---

## 🚀 #4 — CI / GitLab pipeline

CI doesn't upload images itself — limits there don't matter. The
`.gitlab-ci.yml` simply deploys the code; the running Node process is what
serves uploads. No CI changes needed for 413s.

---

## 🔧 Diagnosing 413 / upload failures

| Browser shows | What's failing | Fix |
|---|---|---|
| `413 Request Entity Too Large` (HTML page, not JSON) | Proxy (nginx / Apache) | `client_max_body_size` / `LimitRequestBody` |
| `413` with JSON `{success:false,error:"PayloadTooLargeError…"}` | Express body-parser | Already 25 MB in `server.js` |
| `400 File too large` JSON | Multer per-file limit | `MAX_FILE_BYTES` per route file |
| `502 Bad Gateway` mid-upload | Proxy timed out | `proxy_read_timeout` / `client_body_timeout` |
| Browser hangs forever | Network or proxy buffer | `proxy_request_buffering off` |

---

## TL;DR — what changed in this commit

1. **Express**: JSON + urlencoded body limits → 25 MB (was 100 KB default)
2. **Multer**: media uploads → 25 MB per file (was 8 MB)
3. **Multer**: Excel imports → 20 MB (was 6 MB)
4. **Browser**: auto-compresses images > 600 KB to ≤ 2000-px JPEG before upload
5. **This file**: ops cheatsheet for the proxy layer

Combined: a 12 MB Retina screenshot from your laptop is now compressed to
~700 KB before it ever hits the network. Even on a default 1 MB nginx
`client_max_body_size`, that goes through cleanly.
