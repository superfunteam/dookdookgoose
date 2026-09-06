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

The score uses playful sampled instruments, mallets, springy bass, and percussion with a PS1-era feel. Each chase has a different rhythm and instrumentation. Dialogue music leaves room for spoken performances and subtitles. The 23 lines are voiced by three original synthetic British characters: an energetic Hackney/Cockney ferret, a relaxed London Goose Michael, and a formal zoo announcer. Speaker labels still use the player’s chosen ferret name; Goose greets them with “Oh, there you are!” so the recording works for every name.

Eighteen effects cover menu confirmation, incoming messages, jumping, barrel rolls, sliding, ferret dooks, bonks, collectibles, hearts, mushrooms, zoo gates, the window, victory, setbacks, Goose honks, landings, the starting cue, and tiny paw contacts. Three quiet environmental beds distinguish the house, woods, and zoo.

## Authoring and packaging

1. Put `ELEVENLABS_API_KEY` in the git-ignored `.env.local` file, or provide it as an environment variable. This is a local authoring credential; it is never sent to game clients.
2. Run `node scripts/generate-audio.mjs` to generate missing masters. To select individual assets, append names such as `sfx/dook music/title`. Existing masters are skipped. Requests are sequential, and uncertain failures are not automatically retried.
3. Run `node scripts/prepare-audio.mjs` to package `public/audio/`. FFmpeg and ffprobe are required for this authoring step. The mix report records source measurements and transformations.
4. Run `npm run build` to include the prepared audio in the game and its offline cache. Playing the game makes no ElevenLabs API requests and consumes no generation credits.

Normal game builds use the checked-in audio and do not need an API key or FFmpeg. Keep source masters outside `public/` so phones download only the prepared game assets.

API references: [Compose music](https://elevenlabs.io/docs/api-reference/music/compose) and [Create sound effects](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert).

## Playback and verification

Music crossfades between scenes; speech lowers music and ambience while a line plays. Each line can be replayed or skipped immediately. Advancing, skipping, muting, and leaving the foreground cancel both pending and active speech; cancelled lines never restart unexpectedly. Paw taps follow the ferret rig's stride phase. Pausing or leaving the foreground suspends the audio clock; resuming preserves the music position. The music toggle leaves environmental sound and effects available, and master mute silences all buses. Pending character reactions are cancelled when their dialogue changes.

Decoded audio is bounded to two recent scores, one ambience buffer, three spoken lines, and the short effects. The following line is prefetched without playing early. Rapid pickups have cooldowns and limited overlapping voices. Failed asset loads stay quiet and back off before retrying.

The prepared pack is approximately 4.34 MiB. Seven scores measure within 0.47 LU of the −20 LUFS target, and three ambience loops within 0.54 LU of −28 LUFS. The ten looping assets use a 40 ms circular overlap; decoded loop-boundary changes are smaller than each track's high-percentile ordinary sample transitions. Those 28 files, plus 23 dialogue clips (about 1 MiB), decode in the browser and are included in the production offline cache. Spoken lines are normalized to −18 LUFS with a −2 dBTP target and packaged as mono 96 kbps MP3s. Deliberate pauses are preserved; only outer silence is trimmed.

`npm run test:audio` exercises playback lifecycle and failure handling using local fixture audio. `GAME_URL=http://localhost:5174/ npm run test:audio-campaign` drives the real generated soundtrack through the story. `npm run test:pwa` checks all 51 audio assets while offline. Browser checks use local Chrome; physical phone audio hardware has not been tested.

## Spoken dialogue authoring

`src/dialogue.js` assigns stable IDs to every story line. `assets/dialogue/cast.json` preserves the three original voice-design descriptions; `voices.json` records the saved voices. The designs use ElevenLabs `eleven_ttv_v3`; performances use `eleven_v3` with per-line delivery cues. Speech masters and generation records remain outside the deployed files.

- `node scripts/design-dialogue-voices.mjs preview ferret` creates auditions for a character; existing auditions are protected from accidental regeneration. `save ferret 0` saves a selected design. Goose and announcer use their own character IDs.
- `npm run audio:dialogue` generates missing lines sequentially and packages them. An individual ID can be appended, such as `house-intro-01`. Run only one generation process at a time. Existing masters are protected by a hash of the subtitle text, and paid requests are not automatically retried.
- `npm run audio:dialogue-prepare` repackages existing masters without an API call. FFmpeg and ffprobe are required only for authoring.

API references: [Voice Design](https://elevenlabs.io/docs/api-reference/text-to-voice/design), [Save voice](https://elevenlabs.io/docs/api-reference/text-to-voice/create), and [Text to Speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).

All 23 prepared lines were independently transcribed using ElevenLabs Scribe v2 without reference text. `assets/dialogue/qa.json` stores the recognized words, timings, and final audio hashes; all normalized lines match, allowing “Dook” to transcribe phonetically as “Duke.” This checks wording, not a listening or accent review. `node scripts/qa-dialogue.mjs --check` checks these saved results without API calls. An explicit run without `--check` transcribes only new or changed recordings.

`npm test` includes the dialogue asset checks and requires ffprobe to verify the actual MP3 format and duration. Normal `npm run build` deployment still needs only Node and the checked-in assets.
