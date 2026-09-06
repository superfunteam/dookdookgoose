# Dook, Dook, Goose! — visual development

The two references were generated with the built-in image-generation tool. The initial requests failed (network error, then a reported account limit); the fresh character request succeeded after the user reported upgrading. No fallback image service or CLI was used.

## Character reference

Saved at `public/art/character-reference.png`. This is the visual target, not a replacement for the actual game models. The game renders animated, low-poly Three.js meshes with pixel-textured materials. Character-sheet crops are used for dialogue portraits.

Prompt:

Use case: stylized-concept. Asset type: character model reference sheet for Dook, Dook, Goose!, a premium PS1-style 3D game for vertical phones. Design TWO lovable low-poly game characters on a plain warm cream backdrop. Left 65 percent: the hero FERRET, full-body three-quarter view at large scale plus smaller side and rear views below. A true quadrupedal sable ferret: long flexible noodle body, short little dark paws, cream rounded face with dark brown bandit eye mask, tiny pink nose, round ears, bright black eyes with white gleam, long tapered brown tail, orange triangular neckerchief. Expressive eager mischievous face. Right 35 percent: GOOSE MICHAEL, a charming white goose with long neck, orange flat beak and webbed feet, tiny dark green bucket hat, holding two gelato cones, one pistachio and one strawberry. Large three-quarter full body plus small side view. Style: beautiful actual flat-shaded low-poly 3D, authentic 1998 PlayStation character geometry, 300-700 polygons, angular silhouettes but warm character appeal, pixelated hand-painted textures, delicious warm baked lighting, crisp chunky shapes. Not photorealistic, not modern smooth Pixar CGI, not furry. Consistent design between poses, clean useful geometry and colors that can be faithfully rebuilt in Three.js. No text or labels.

## Environment reference

Saved at `public/art/environment-reference.png`. It guides the house's teal walls and wood beams, the forest's tall canopy and creek, and the zoo's green arches, coral architecture, and open-top human exhibits.

Prompt:

Use case: stylized-concept. Asset type: three-environment visual target board for a chunky premium 1998 PS1 3D portrait runner, Dook Dook Goose. One landscape image with THREE side-by-side vertical gameplay views at identical camera angle: camera 4 feet behind and above a small long-bodied brown sable ferret with cream face and orange neckerchief running away from camera along a three-lane path. Left panel: Breaking Out, inside oversized charming cozy house, rich teal patterned wallpaper, warm wood planks, rugs, cabinets, small tables to slide underneath, boxes and an open bright window at the far end. Center panel: Into the Woods, dense lush angular forest trees framing golden dirt path, ferns and bright orange mushrooms at sides, a fallen log and a turquoise creek. Right panel: The Zoo, pastel coral walls, dark green wrought iron OPEN-TOP enclosures at sides containing visible miniature office-worker humans in shirts and ties, cream tiled promenade, green zoo arch, terracotta planters, striped orange-and-cream gelato cart. Visual fidelity: actual low-poly 3D game geometry, hand painted pixel textures, chunky warm silhouettes, 320x480 aesthetic enlarged crisply, warm baked sunlight, atmospheric distance fog, no realistic fur, no shiny modern CGI. Beautiful tasteful earth tones; rich forest green, cream, ochre and muted terracotta. No UI, no text, no labels. A practical reference for real time 3D scene building.

## Render iterations

- Fixed floor z-fighting between the road and underlying terrain.
- Lengthened the ferret torso, raised the neck, thinned the paws, added a smile, adjusted mask colors, and added visible neckerchief tails.
- Replaced smooth solid colors with nearest-filtered pixel textures.
- Adjusted portrait character framing independently from desktop framing.
- Added house ceilings and beams, taller forest canopy, flowers and a creek, zoo arches and human faces.
- Removed solid enclosure roofs so the human exhibits are visible.
- Batched static scenery by material to reduce mobile draw calls.

Screenshots in `output/qa/` document actual browser-rendered scenes and gameplay checks. The models are procedural interpretations of the reference, not exact mesh reconstructions.

## Movement reference — character rebuild

The built-in image-generation tool generated `public/art/movement-reference.png`, using `public/art/character-reference.png` as the character identity reference. No image-service fallback was used. The actual character renders and skeletal motion are in `output/qa/character-motion-preview.mp4`; rig details are in `docs/character-rig.md`.

Prompt:

Use the attached character sheet as the strict character identity reference. Create an ANIMATION MODEL SHEET of the SAME quadrupedal sable ferret, not a new design. Wide cream background, FIVE large numbered-in-order side-view key poses arranged clearly as a 3-on-top, 2-on-bottom sheet with ample separation and small ground lines. Keep exact reference long lean body, cream face with brown bandit mask, short connected legs with distinct little toes, tapered long tail, orange triangular neckerchief, happy expression, faceted PS1 game meshes and pixel fur textures. Pose 1: grounded gathering bound, lumbar backbone visibly arches upward, hind feet brought under the belly, forepaws supporting forward chest. Pose 2: powerful hind-leg push-off, hind feet planted, torso lengthens, front paws lift/reach forward, spine uncoils. Pose 3: airborne stretched bound, horizontal long flexible body, forepaws reaching forward and hind legs trailing behind, tail follows. Pose 4: airborne BIG JUMP with a 360-degree BARREL ROLL halfway through: ferret rotated 180 degrees about its nose-to-tail long axis, belly skyward, head still pointing forward, four paws tucked toward belly, curved trailing tail. This must be an upside-down side view, not a somersault. Pose 5: soft forepaw landing, front paws reach the ground, elbows flex, hindquarters still lifted, lumbar begins to arch again, tail balances the landing. Anatomically connected shoulder and hip limbs in ALL poses, no floating body parts. Clean useful side silhouettes for rigging, same orthographic camera and scale, premium charming 1998 PlayStation art. Not a cat, not a dog, not a squirrel; preserve the ferret reference. No motion blur, no arrows, no decorative text; five clear poses only.
