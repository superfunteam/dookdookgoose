import {LEVELS, ENDING} from './data.js';

// Stable scene/line IDs are shared by the story player and the audio authoring tool.
const scenes = LEVELS.flatMap(level => [
  {id: `${level.id}-intro`, lines: level.dialogues},
  ...(level.exit ? [{id: `${level.id}-exit`, lines: level.exit}] : [])
]).concat({id: 'ending', lines: ENDING});
const sceneIds = new Map(scenes.map(scene => [scene.lines, scene.id]));
export function dialogueClip(lines, index) {
  const scene = sceneIds.get(lines);
  return scene && lines[index] ? `${scene}-${String(index + 1).padStart(2, '0')}` : null;
}
export const DIALOGUE_LINES = scenes.flatMap(({lines}) => lines.map(([speaker, text], index) => ({
  id: dialogueClip(lines, index), speaker, text,
  character: speaker === 'GOOSE MICHAEL' ? 'goose' : speaker === 'EXHIBIT SIGN' ? 'announcer' : 'ferret'
})));
