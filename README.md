# Dook, Dook, Goose!

A portrait-first, PS1-inspired 3D runner about a very small ferret and a very big misunderstanding. Built with Three.js, Vite, original procedural geometry, pixel textures, and an original ElevenLabs-generated soundtrack and sound effects. No UI framework or ui.sh code.

## Play locally

```sh
npm install
npm run dev
```

Open the address printed by Vite. A phone on the same Wi-Fi can open the printed Network address. `npm run build` makes a self-contained static build in `dist`; `npm run preview` serves that build.

The title screen starts the name form before any story dialogue. Your hero becomes **Ferret [Name]**. Name, chapter unlocks, high score, and audio preferences save locally in the browser when storage is available.

## Three chapters

1. **Breaking Out:** slide under furniture and jump through the center window to escape the house.
2. **Into the Woods:** jump onto orange mushrooms to launch over the creek; dodge logs and duck branches.
3. **The Zoo:** DOOK to open striped gates. The enclosures contain humans. Goose Michael was waiting with two gelatos all along.

Each chapter has an introduction, a mechanic briefing, gameplay, and a completion scene. Finishing the story unlocks an endless forest run with increasing speed and fresh course segments.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Change lane | Swipe left/right or arrow buttons | Left/right arrows; A also moves left |
| Jump | Swipe up or Jump | Up, W, or Space |
| Slide | Swipe down or Slide | Down or S |
| Open zoo gates | DOOK button | D or E |
| Pause/resume | Pause button | Escape or P |
| Advance dialogue | Next | Enter |

Collect gold shiny things and pink recovery hearts. Three collisions end the run; retry restarts the current chapter. Switching tabs automatically pauses gameplay. The music and effects start only after a user interaction, as browsers require.

The runner starts at 31.5–39 metres per second, three times the original pace. Courses are longer to preserve each chapter's play time while delivering more obstacles. Bounding hops are the normal movement, with cadence increasing as the run speeds up. Jumps have compact arcs; swipe down while airborne to dive into a slide. Obstacle prompts use arrival time, and collision detection covers the travelled interval between frames.

## Validation

```sh
npm test
npm run test:browser
npm run test:pace
```

The browser campaign script uses an installed Google Chrome and drives the real keyboard controls through all three chapters, then checks the ending and endless unlock. `tests/inspect-levels.mjs` captures all three portrait levels; `tests/capture.mjs` captures desktop and mobile title screens. Screenshots are in `output/qa`.

## Art development

Generated character and environment references are in `public/art`. Exact prompts and the render iteration notes are in `docs/art-direction.md`. Gameplay is live 3D, including animated ferret/Goose models, scenery, obstacles, shadows, and collision mechanics. Reference images supply the dialogue portrait crops; all UI is original HTML/CSS.

Requires WebGL and a modern browser. The game targets portrait mobile play and also adapts to desktop. This is a complete small web game with a PS1-inspired aesthetic, not a native PlayStation executable or a claim of commercial AAA production scale.

## Character rig and barrel rolls

Both characters have been rebuilt from the approved art reference. The ferret now has a continuous, watertight sculpt and a real 30-bone skeleton (including eight facial bones) with weighted skinning and inverse-kinematic paws. Run/scamper, bounds, jump, slide, and big-jump barrel rolls have distinct poses. **Jump again in midair, or press R, for the big jump and full 360° roll.**

Open `/character-lab.html` to orbit the models, slow or pause motion, and inspect the skeleton and wireframe. See `docs/character-rig.md` for the rig, model authoring pipeline, movement reference, and validation. `npm run test:rig` checks skin weights, paw contacts, and the in-game roll.

## Sharing and home-screen app

Production address: **https://dookdookgoose.superfun.games/**. The build includes generated social cover art, ferret face icons, static Open Graph/Twitter metadata, canonical links, structured game data, a sitemap, and robots.txt. Share and Add to Home Screen controls are in the header and help panel. The portrait standalone app works offline after its first successful online load; updates wait until existing game tabs close.

`npm run build` prepares the full deployable `dist/` folder. `npm run preview -- --port 5174` serves it for `npm run test:pwa`. `npm run test:install` tests sharing and installation with mocked native prompts against the development server. See `docs/branding.md` for artwork, exact prompts, deployment headers, and platform behavior. Physical phone installation and public hosting require their respective device/host; neither is implied by the local browser checks.

## Music and sound

Seven instrumental scores cover the title, dialogue, three action chapters, gelato ending, and setbacks. Eighteen effects include ferret dooks, Goose honks, paw contacts, barrel rolls, slides, gates and the window escape; quiet ambience distinguishes each environment. The sound button mutes all audio, and the help panel has a separate music switch. Audio starts after interaction and pauses with gameplay or when the page is hidden.

Prepared audio is checked in under `public/audio`, works offline after the first complete download, and makes no live API requests. See `docs/audio.md` for the soundtrack and optional generation/packaging commands. API credentials remain in ignored local environment files.

## Deploy on Netlify

The checked-in `netlify.toml` sets the build command to `npm run build`, publish directory to `dist`, and Node to version 22. Connect this repository's `main` branch and deploy normally. Netlify must publish the built `dist/` folder: publishing the repository root serves raw JavaScript imports and causes CSS module MIME errors and missing public assets.

After deployment, the homepage should load a hashed `/assets/game-*.js` module, and `/favicon.ico`, `/manifest.webmanifest`, and `/sw.js` should return successfully. The character studio remains available at `/character-lab.html`. No SPA catch-all rewrite or API credentials are required.
