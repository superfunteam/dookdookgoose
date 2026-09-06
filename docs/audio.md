# The pocket soundtrack

Original game audio is generated with ElevenLabs: **Music v2** for instrumental scores and **Sound Effects v2** for effects and environmental loops. The full prompts are in `assets/audio/plan.json`; generation provenance is in `assets/audio/generation.json`. Audio masters are preserved under `assets/audio/masters/`.

## Music and scene coverage

| Cue | Scene |
| --- | --- |
| A Very Urgent Little Adventure | Title, naming your ferret, chapter selection |
| Behind Bars. Hurry. | Dialogue, chapter briefings, and between-level scenes |
| Breaking Out | Fast house escape |
| Mushroom Airlines | Forest chase and endless mode |
| Excuse Me, Important Ferret | Zoo rescue chase |
| Two Scoops, Zero Rescues | Gelato reveal and credits |
| Oh, Dook | Setback and retry screen |

The score uses playful sampled instruments, mallets, springy bass, and percussion with a PS1-era feel. Each chase has a different rhythm and instrumentation. Dialogue music leaves room for reading; character reactions are animal sounds rather than spoken recordings, preserving the player's chosen ferret name.

Eighteen effects cover menu confirmation, incoming messages, jumping, barrel rolls, sliding, ferret dooks, bonks, collectibles, hearts, mushrooms, zoo gates, the window, victory, setbacks, Goose honks, landings, the starting cue, and tiny paw contacts. Three quiet environmental beds distinguish the house, woods, and zoo.

## Authoring and packaging

1. Put `ELEVENLABS_API_KEY` in the git-ignored `.env.local` file, or provide it as an environment variable. This is a local authoring credential; it is never sent to game clients.
2. Run `node scripts/generate-audio.mjs` to generate missing masters. To select individual assets, append names such as `sfx/dook music/title`. Existing masters are skipped. Requests are sequential, and uncertain failures are not automatically retried.
3. Run `node scripts/prepare-audio.mjs` to package `public/audio/`. FFmpeg and ffprobe are required for this authoring step. The mix report records source measurements and transformations.
4. Run `npm run build` to include the prepared audio in the game and its offline cache. Playing the game makes no ElevenLabs API requests and consumes no generation credits.

Normal game builds use the checked-in audio and do not need an API key or FFmpeg. Keep source masters outside `public/` so phones download only the prepared game assets.

API references: [Compose music](https://elevenlabs.io/docs/api-reference/music/compose) and [Create sound effects](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert).

## Playback and verification

Music crossfades between scenes; dialogue reactions briefly lower the score. Paw taps follow the ferret rig's stride phase. Pausing or leaving the foreground suspends the audio clock; resuming preserves the music position. The music toggle leaves environmental sound and effects available, and master mute silences all buses. Pending character reactions are cancelled when their dialogue changes.

Decoded audio is bounded to two recent scores, one ambience buffer, and the short effects. Rapid pickups have cooldowns and limited overlapping voices. Failed asset loads stay quiet and back off before retrying.

The prepared pack is approximately 4.34 MiB. Seven scores measure within 0.47 LU of the −20 LUFS target, and three ambience loops within 0.54 LU of −28 LUFS. The ten looping assets use a 40 ms circular overlap; decoded loop-boundary changes are smaller than each track's high-percentile ordinary sample transitions. All 28 files decode in the browser and are included in the production offline cache.

`npm run test:audio` exercises playback lifecycle and failure handling using local fixture audio. `GAME_URL=http://localhost:5174/ npm run test:audio-campaign` drives the real generated soundtrack through the story. `npm run test:pwa` checks all 28 audio assets while offline. Browser checks use local Chrome; physical phone audio hardware has not been tested.
