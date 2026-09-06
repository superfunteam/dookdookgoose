# Branding, sharing, and home-screen installation

Production origin: **https://dookdookgoose.superfun.games/**. It is the default in `build/site-meta.mjs`; `SITE_URL` can override it for another deployment. The game is hosted at the domain root.

## Generated artwork

Two separate reference-guided generations used the built-in GPT Image tool and `public/art/character-reference.png`. Original character art is preserved. Full final prompts and generation mode are recorded in `assets/branding/prompts.json`.

| Asset | Source master | Shipped files |
| --- | --- | --- |
| Ferret + Goose woodland gelato scene, with title | `assets/branding/og-master.png` (1730 × 909) | `public/social/og-image.jpg` (1200 × 630) |
| Smiling ferret face with orange bandana | `assets/branding/ferret-icon-master.png` (1254 × 1254) | PNG app icons at 192/512 px; Apple touch icon at 180 px; 16/32/48 px favicons and multi-size ICO |
| Android adaptive icon | Same smiling face, mechanically reduced with matching green padding | `public/icons/maskable-512.png` |

Run `node scripts/build-branding.mjs` to reproduce the web derivatives with ImageMagick. It only resizes, formats, and pads the image-model artwork. Masters live outside `public/` and are not shipped to phones. Icons are opaque, without pre-rounded corners; the padded maskable version keeps the face inside the central safe circle.

## Metadata

Vite writes the metadata into static HTML, so social crawlers do not need JavaScript. Both entry pages receive icons, theme color `#173d32`, canonical URLs, Open Graph and Twitter large-image cards. The game also includes VideoGame/SoftwareApplication JSON-LD. The character lab has `noindex, follow`, and the sitemap includes only the game. `robots.txt` points to the production sitemap.

The share button uses the canonical game URL, excluding query strings, fragments, and the player's locally saved name. Native sharing requires a click. Unsupported browsers copy the link, or present a selectable link if clipboard access is unavailable. Opening sharing or installation pauses an active run.

## Home screen and offline play

The manifest configures a portrait standalone app, stable app ID, launch URL, theme/background colors, and standard plus maskable icons. Install controls appear in the header and help panel, with extra desktop footer links. Supported browsers receive their native install prompt only after a click. Other browsers receive manual instructions; iOS uses Share → Add to Home Screen. Installed standalone windows hide the install controls and accommodate screen safe areas.

Production builds emit `sw.js`. After the first successful online load and worker installation, the game, character lab, textures, and fonts work offline. Updates wait for existing tabs to close; the worker never reloads a running game. Unused movement art and social/crawler files are omitted from the offline precache. Development does not register a worker.

## Deployment

1. Run `npm run build` and upload the complete `dist/` directory to the root of **dookdookgoose.superfun.games**, served over HTTPS.
2. Serve `index.html`, `character-lab.html`, and `sw.js` with `Cache-Control: no-cache` so updates can be checked. Hashed `/assets/` files can use `public, max-age=31536000, immutable`. Unhashed icons, manifest, and social art should revalidate.
3. Serve `.webmanifest` as `application/manifest+json`, `.js` as JavaScript, and the image formats with their matching MIME types. Keep `/sw.js` at the domain root.
4. Confirm the public homepage and `/social/og-image.jpg` are reachable without authentication before refreshing social-platform preview caches. Changes are prepared locally; this task does not configure DNS or publish to a hosting provider.

Browser install support follows the [web app manifest guidance](https://web.dev/learn/pwa/web-app-manifest), [maskable icon guidance](https://web.dev/articles/maskable-icon), and [MDN installability guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable). Physical iPhone installation still requires device testing.
