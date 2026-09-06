# Validation

Verified in local Google Chrome with Playwright, using the real UI and keyboard/touch input paths. The game state inspection API is read-only.

- Production Vite build passes.
- Eighteen course, mechanic, mesh-topology, pacing and metadata tests pass.
- Full campaign completes all three chapters with three hearts remaining in each chapter.
- The faster campaign exercised 20 jumps, 67 slides, 27 DOOK calls and 18 aerial dives.
- Full ending and endless-mode unlock pass.
- Name entry occurs before the first dialogue; speaker labels, HUD, credits, and Goose's greeting use the chosen name.
- Whitespace-only name rejection and subsequent valid entry pass.
- Swipe lane change and jump pass.
- Pause freezes distance; help does not resume gameplay accidentally.
- Local name persistence, locked chapters, no-input failure, and retry pass.
- Production-preview save recovery passes for null, arrays, strings, numbers, booleans, malformed JSON and unavailable browser storage. Valid name, chapter progress, score and audio preferences are preserved.
- Portrait 375×667 and 390×844, tablet 768×1024, and desktop 1440×1000 layouts have no horizontal document overflow.
- Endless mode crosses 1,250 meters, generates its next segment, and retains three hearts.
- Campaign, UI, and endless browser checks report no JavaScript errors.
- Static scenery batching reduces observed forest draw calls from approximately 900 to 260, and zoo draw calls from approximately 1,100 to 345.

Actual rendered screenshots are saved in `output/qa/`. Physical phone hardware and mobile Safari have not been tested; mobile layouts and pointer controls were tested in Chrome with a portrait viewport.

Commands: `npm test`, `npm run test:browser`, `npm run test:ui`, `npm run test:save`, `node tests/endless.mjs`, and `node tests/final-scenes.mjs`. Start the local server before the browser scripts.

## Faster action pass

Chapter starting speeds are 31.5 / 36 / 39 m/s, three times the earlier speeds. Their lengths are 1,260 / 1,530 / 1,620 m, preserving roughly the same chapter durations while tripling action density. All three chapters and the ending pass at this pace with three hearts each. Endless mode also passes its first segment at more than 38 m/s.

Bounding is the default gameplay gait from the first frame. The 30-bone rig retains planted-paw IK with a larger 0.21-unit body spring and cadence from 3.6 to 4.3 Hz. A separate 960-pose sampling run verifies contact heights, finite skin deformation, full arch range and a complete 2π roll.

`src/pacing.js` owns travel/physics tuning and swept collision helpers. The interval test covers obstacles between rendered frames, including a 50 ms frame at the 66 m/s endless cap. Jump arcs are shorter, lane changes respond faster, and down input initiates an aerial dive into a slide. Cues and the gameplay test bot use arrival time instead of fixed metre thresholds.

## Social art and installable app

- The generated Open Graph image is a 1200×630 JPEG, approximately 358 KiB. PNG app icons at 192/512 px, a padded 512 px maskable icon, 180 px Apple touch icon, and 16/32/48 px multi-resolution favicon are verified.
- Static HTML contains production canonical/OG/Twitter URLs at https://dookdookgoose.superfun.games/, with image dimensions and alt text, theme color, manifest links, and valid game structured data. The lab is noindex; the sitemap contains the game root only.
- Eight dedicated metadata tests pass, including root-domain validation and override handling.
- Production service-worker precaching and real offline navigation pass. After disabling browser network access, the home-screen launch URL opens, name entry and chapter gameplay work with the full 30-bone rig, and the character lab renders offline. No JavaScript errors.
- Install/share regression passes against production and development: mocked native share/cancellation, canonical URL privacy, clipboard denial/manual copy, dialog focus trapping, Escape preserving game pause/help, deferred install prompt, installed-state controls, simulated iOS instructions and standalone mode. Tests invoke no real OS share or install action.
- Added header controls fit 320, 375, 390, 768 and 1440 px widths. Mobile and desktop production screenshots were inspected. Existing touch, name entry, pause/help, persistence, lock, retry and responsive UI regression passes.
- Native installation on physical iOS/Android hardware and public deployment have not been performed.

Run `npm run test:pwa` against production preview on port 5174, and `npm run test:install` against development on port 5173 (or set `GAME_URL` to the preview origin).
