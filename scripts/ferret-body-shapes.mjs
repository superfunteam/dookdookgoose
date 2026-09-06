/**
 * The standing hero in the approved sheet has a low shoulder saddle, a fuller
 * rear haunch and an abdomen that tucks up behind the chest. The smaller side
 * drawing is crouching; its belly clearance should come from the pose, rather
 * than shortening the legs or moving their existing rig anchors.
 *
 * Coordinates use the sculpt's existing +Z nose / +Y up convention. These three
 * fields replace the original torso, haunch and shoulder fields respectively.
 */
export function makeBodyShapes({ellipsoid}) {
  return [
    // Keep the underside at .59 while filling out the reference’s broad flank.
    // A slightly narrower waist prevents the torso reading as a uniform barrel.
    p => ellipsoid(p, [0, 1.05, -0.27], [0.425, 0.460, 1.12]),

    // The rear crest rises 0.13 above the old back line, with lateral hip mass
    // blending into the existing thigh roots instead of creating longer legs.
    p => ellipsoid(p, [0, 1.06, -0.89], [0.445, 0.460, 0.56]),

    // A deeper anterior chest puts the lowest torso mass behind the forelegs;
    // the belly then rises toward the hindquarters as it does in the reference.
    p => ellipsoid(p, [0, 0.98, 0.63], [0.380, 0.430, 0.48]),
  ];
}
