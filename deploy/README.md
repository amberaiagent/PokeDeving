# Deploy — landing + game on one VPS (Docker + nginx + Cloudflare)

Three containers: `proxy` (nginx, TLS, routes by domain) → `landing` (static) + `game` (Express).

```
landing  →  pokeripping.fun     (replace with your landing domain)
game     →  pokedungeon.fun
```

---

## 1. Cloudflare (DNS + SSL)

For **each** domain (do it twice — once per zone):

1. Add the domain to Cloudflare and point your registrar's nameservers to the ones Cloudflare gives you.
2. **DNS** → add records, **Proxied (orange cloud)**:
   - `A  @    <VPS_IP>`
   - `A  www  <VPS_IP>`  (or `CNAME www  <domain>`)
3. **SSL/TLS → Overview** → set encryption mode to **Full (strict)**.
4. **SSL/TLS → Origin Server → Create Certificate** (RSA, hostnames `pokedungeon.fun, *.pokedungeon.fun`). Save the two blocks into `deploy/certs/` on the VPS:
   - certificate → `deploy/certs/pokedungeon.pem`
   - private key → `deploy/certs/pokedungeon.key`
   Repeat for the landing domain → `pokeripping.pem` / `pokeripping.key`.
5. (Recommended) **SSL/TLS → Edge Certificates → Always Use HTTPS = On**.

> Origin certificates are per-zone, so you generate one pair per domain — hence the two cert files referenced in `proxy.conf`.

---

## 2. VPS (Ubuntu/Debian)

```bash
# install Docker + compose plugin
curl -fsSL https://get.docker.com | sh

# get the project onto the server (git clone or scp the folder), then:
cd sinsh-alavi
mkdir -p deploy/certs            # put the 4 cert files from Cloudflare here

# build + run everything
docker compose up -d --build

# check
docker compose ps
docker compose logs -f proxy
```

Update afterwards (new code):
```bash
git pull          # or re-copy files
docker compose up -d --build
```

---

## 3. Edit before first run

- In `deploy/proxy.conf`: replace `pokeripping.fun` with your real landing domain (2 places).
- Make sure `deploy/certs/` has all 4 files with the exact names above.
- **Never commit `deploy/certs/`** — add it to `.gitignore`.

---

## Firewall (optional but recommended)

Only Cloudflare should reach the origin. Allow 22 (SSH), and 80/443 from Cloudflare IP ranges only:
<https://www.cloudflare.com/ips/>

---

## Notes

- The game's whitelist is **in-memory** — it resets when the `game` container restarts/redeploys. If you need it to persist, say so and I'll add a volume + file/DB store.
- Real visitor IP arrives as the `CF-Connecting-IP` header (Cloudflare) → already forwarded as `X-Forwarded-For` to the apps.
- Simpler-but-less-secure alternative to step 1.4: set Cloudflare SSL mode to **Flexible** and drop the `ssl_*`/443 blocks (Cloudflare ↔ origin over HTTP). Origin certs + Full (strict) is the better default.

### Alternative: Cloudflare Tunnel (no open ports, no origin certs)
If you'd rather not expose 80/443 at all: run a `cloudflared` container, create a Tunnel in the Cloudflare dashboard, and map `pokedungeon.fun → http://game:3000` and `pokeripping.fun → http://landing:80`. Then you don't need the `proxy` container or certificates. Ask me and I'll swap the compose to this setup.
