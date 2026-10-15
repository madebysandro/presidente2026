# Placeholder page

The public site shows the brand **Presidente 2026 · 2º turno** and an **Em breve** message until the pesquisas UI ships.

## Sub-features

- `home-brand` shows the brand line and title.
- `home-csp` sends the base Content-Security-Policy on HTML.
- `home-no-tela2` has no Tela 2 / Pará / proporcionais chrome.

## How to get to it (user POV)

- Open `http://127.0.0.1:8787/` in a browser.
- Open the same URL with a headless screenshot tool.

## Driving it with Playwright / curl

Preconditions:

- Worker healthy at `$VERIFY_URL` (`doctor.sh` PASS).

- **Load home.** Navigate to `/`. Run `curl -sS "$VERIFY_URL/" -o evidence/home.html` or Playwright `browser_navigate`. Body contains `Presidente 2026` and `Em breve`.
- **Screenshot.** Capture the viewport. Run `npx playwright screenshot "$VERIFY_URL/" evidence/home.png`. File is non-empty and shows the brand.
- **CSP.** Inspect response headers. `content-security-policy` includes `default-src 'self'` and `frame-ancestors 'none'`.
- **Proof.** ARIA/text snapshot or HTML dump plus screenshot both show the brand; no `Governador` / `Tela 2` strings.

## Gotchas

- Static assets are served after the Worker wraps them with CSP; check headers on `/`, not only on `/css/placeholder.css`.
- `workers_dev` is false in config; local verify still uses `wrangler dev --ip 127.0.0.1`.
