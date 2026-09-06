# Character rebuild and motion rig

The ferret and Goose Michael were rebuilt against the approved character reference. The old detached ellipsoids and leg groups have been replaced by authored continuous sculpts and weighted skeletal deformation.

## Play and inspect

- Game: `http://localhost:5173/`
- Character studio: `http://localhost:5173/character-lab.html`
- Frozen reference comparison: `http://localhost:5173/character-lab.html?compare=1`
- Full-body and face comparisons: `output/qa/reference-comparison/`
- Earlier rig motion reel (before the likeness revision): `output/qa/character-motion-preview.mp4`
- Generated movement reference: `public/art/movement-reference.png`

The studio has independent Idle, Scamper, Bound, Jump, Big jump + 360°, and Squeeze previews, an orbit camera, a side view, a pause button, playback speed, wireframe, and a live skeleton overlay. Goose has a separate inspection mode.

During gameplay, jump again in midair for the big jump and barrel roll, or press **R**. Mushroom launches also trigger the roll. The rotation is around the body's longitudinal axis, with a pivot through the trunk. It reaches a complete 2π rotation before landing. Animation pauses with gameplay.

## Actual geometry and skeleton

The ferret uses a `THREE.SkinnedMesh` with a 30-bone `THREE.Skeleton`: pelvis; lumbar, thoracic and shoulder spine joints; neck; head; four tail joints; and upper-leg, elbow/hock, and paw joints for all four legs. The body is a single connected, closed manifold surface: 2,602 welded source vertices and 5,200 triangles. Render corners are split for constant per-triangle color variation. Goose's continuous body and neck have 1,102 vertices and 2,200 triangles, with a four-bone body/neck/head rig. Eyes, ears, scarf, wings, hat, claws and cones add separate detail meshes attached to their appropriate parent joints or character.

Each skin vertex has up to four normalized bone weights. The face mask is pigmentation on the head surface. The lower legs darken toward the paws. Pixel-patterned shading follows the rest surface so the markings deform with the skin.

Two-segment inverse kinematics places the ferret's paw joints during ground-contact phases. Reach limits shorten an unreachable step while preserving contact height. The spine gathers into a lumbar arch, lengthens on push-off, and flexes again toward the next landing. Running defaults to bounding, coupling the front and rear pairs with a small left/right offset; scampering is available explicitly in the studio and uses staggered diagonal footfalls. Bound cadence rises smoothly from 3.6 cycles per second at 31.5 m/s to 4.1 at 45 m/s, reaching a capped 4.3 at 66 m/s in endless play. A stronger 0.21-unit body spring peaks after forepaw release into the stretched pose; its small lower stance preserves planted-paw reach. This visual suspension is separate from the player's jump and collision height. Airborne poses tuck the paws, then release the tuck toward landing; landing adds a short compression. Sliding is a crouched skeletal pose, without flattening the whole character's scale.

These are stylized game animations, not motion capture or a claim of exact biomechanical simulation. Ferret locomotion includes multiple gaits and context-dependent posture. The art poses and rig direction were informed by [Horner and Biknevicius, overground and tunnel locomotion](https://pubmed.ncbi.nlm.nih.gov/20545058/), [Moritz et al., paravertebral muscles and spinal function](https://pubmed.ncbi.nlm.nih.gov/17512707/), and [lateral movement coordination in ferrets](https://pubmed.ncbi.nlm.nih.gov/9711818/).

## Rebuilding the sculpt assets

The checked-in meshes load directly; Python is not needed to play or build the game. To regenerate them:

```sh
python3 -m venv .tools/model-build
.tools/model-build/bin/pip install -r scripts/requirements-models.txt
npm run models:build
```

The authoring script samples smooth implicit anatomy with marching cubes. The refinement step uses quadric-error simplification and asserts watertightness and Euler characteristic 2 before saving the game meshes. Runtime rigging and skin weights are in `src/characters.js`.

## Validation

- Both sculpt meshes are connected, finite, closed manifolds with exactly two faces per edge.
- All 30 ferret bones are present and the body is an actual skinned mesh.
- Maximum measured skin-weight normalization error: 4.5 × 10⁻⁸.
- Across 40 bound poses, planted paw joint heights match their target within floating-point tolerance.
- Spine flexion covers the full authored arch range.
- Barrel rotation reaches exactly 2π; in-game roll, pause/resume, landing and double-jump inputs pass.
- Full three-chapter keyboard playthrough passes with three hearts in every chapter.
- The rendered motion reel contains 192 frames; no browser or shader errors were reported.

Run `npm test`, `npm run test:rig`, and `npm run test:browser`. The server must be running for browser tests.

## September 6 likeness revision

Frozen comparisons exposed a narrow muzzle, bead-like eyes, a jaw disconnected visually from the face, a buried scarf, pinched torso volumes, too little cream throat, and fine uniform noise rather than the approved mosaic. The revision broadens the skull and body, shortens the split muzzle, carves a tapered mouth opening, recesses the smaller faceted eyes, gives the mask sharper edges and warmer bridge coloring, and separates the alert throat from the collar. The bib now drapes around the chest with a folded hem, knot and two tails. Resting tail joints curve and orient along their chain; running retains the extended tail.

The face follows the skull across head turns; blending is confined to the throat. Alert head height is lowered during running and crouching. The welded anatomy is simplified to 5,200 triangles; render corners carry subtle per-face values. Pixel pigmentation uses the approved sheet's smaller flank swatch (x=402–466, y=455–519), with contrast restored before lighting. It uses nearest sampling and rest-space coordinates. No replacement concept image was generated for this revision: the approved original remained the target.

The studio's **Compare reference** freezes a posed 3D model beside the original; **Face close-up** provides a front inspection. These are live mesh renders, not generated mockups. The result remains a hand-authored interpretation; the comparison intentionally exposes remaining differences in cheek contours, cloth folds and painted detail.

Current verification: seven course/topology tests, the 40-pose skin/IK and in-game roll test, error-free comparison renders, phone title inspection, and production build all pass. The three-chapter campaign result above is from the preceding rig revision; gameplay rules were not changed by the likeness work.

## Facial rig and second proportion pass

The skull is now a tapered section sculpt, with its cheeks and chin in the continuous skin. The separate lower-jaw detail was removed. Smaller wedge-shaped paws, shorter toes, a fuller abdomen and raised back replace the previous proportions.

Eight facial bones extend the original 22-bone locomotion rig: jaw, central snout, paired muzzle halves, cheeks and brows. Facial vertex weights deform the actual skin. The mouth interior is also skinned; its top follows the muzzle while the bottom follows the jaw. Nose and whiskers follow the snout/muzzles and upper teeth follow the muzzle. The tongue has blended jaw/head weights so its root remains inside the mouth while its tip follows the chin. The studio exposes Relaxed, Little grin, Big smile and Dook expressions. Gameplay blends facial poses, smiles during jumps, opens the mouth for the dook action, and smiles on the title and ending.

The dedicated `npm run test:face` checks weighted chin and muzzle deformation, eight facial bones, a skinned mouth interior and error-free rendering. The body rig test also checks that an in-game D input triggers the dook expression. Current expression renders are in `output/qa/expressions/`; live big smile: `http://localhost:5173/character-lab.html?compare=1&expression=happy`.

## Double-density likeness pass

The body-and-face skin now contains exactly 5,200 triangles, twice the previous 2,600. The head and upper throat (triangle centroid above Y=1.6) contain 1,381 triangles, compared with 551 in the prior mesh. The 112-cell implicit sculpt resolves the split muzzle and toes before simplification; an invertible spatial expansion gives the facial region additional importance during quadric-error reduction. Both the raw and reduced meshes must remain watertight with Euler characteristic 2.

The new sculpt lowers the muzzle and nose relative to the eyes, carves the central upper-lip cleft, reshapes the chin, widens the toe-bearing paws and fills out the central torso. Smaller ears sit lower against the skull, and the eyes have taller contours. Separate nostrils and a highlighted nose plane add volume; the smile has a shaded mouth interior and restrained teeth. Facial poses retain the real eight-bone facial rig, with the smile's jaw opening reduced to suit the approved expression.

The orange bandana is now authored in `src/ferret-scarf.js`. Its broad triangular cloth samples the bound chest surface for clearance, with a folded wrap, knot and two animated tails. Its nearest-sampled 32×32 fabric map is generated in code. The neck shares part of an idle head turn so the cloth is visible in the reference pose.

The frozen comparison and four-expression renders were inspected repeatedly against the same approved artwork. This improves the likeness but does not claim an exact reconstruction of the illustrated reference. The rig/contact checks, facial deformation checks, seven course/topology tests and production build pass for this revision.
