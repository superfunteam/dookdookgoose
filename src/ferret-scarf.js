import * as THREE from 'three';

let clothMap;
function fabricMap() {
  if (clothMap) return clothMap;
  const size = 32, data = new Uint8Array(size * size * 4);
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 3), col = Math.floor((x + (row % 3)) / 3);
    const shade = .82 + Math.floor(hash(col, row) * 5) * .065;
    const i = (y * size + x) * 4;
    data[i] = Math.min(255, Math.round(238 * shade)); data[i + 1] = Math.min(255, Math.round(108 * shade)); data[i + 2] = Math.min(255, Math.round(9 * shade)); data[i + 3] = 255;
  }
  clothMap = new THREE.DataTexture(data, size, size);
  clothMap.colorSpace = THREE.SRGBColorSpace;
  clothMap.magFilter = clothMap.minFilter = THREE.NearestFilter;
  clothMap.generateMipmaps = false; clothMap.needsUpdate = true;
  return clothMap;
}

/** A broad, folded fabric bib, fitted to the existing chest without a rigid shell. */
export function makeScarf(neck) {
  const wrap = new THREE.Group(); wrap.name = 'Fitted orange bandana'; neck.add(wrap);
  const cloth = new THREE.MeshStandardMaterial({ map: fabricMap(), color: 0xffffff, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const mesh = (vertices, indices, name, tint = 0xffffff) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(vertices.flatMap(([x, y]) => [x / .85 + .5, (y + .78) / .96]), 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = tint === 0xffffff ? cloth : cloth.clone(); material.color.setHex(tint);
    const result = new THREE.Mesh(geometry, material); result.name = name;
    result.castShadow = result.receiveShadow = true; wrap.add(result); return result;
  };

  // Sample the actual skinned chest in the binding pose, rather than guessing
  // its forward extent. Thin cloth must also clear the chords between samples.
  let root = neck;
  while (root.parent && (root.isBone || root.parent.isBone)) root = root.parent;
  let body;
  root.traverse(object => { if (!body && object.isSkinnedMesh && object.name.includes('continuous skin')) body = object; });
  root.updateWorldMatrix(true, true); body?.skeleton.update(); body?.computeBoundingSphere();
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1).transformDirection(neck.matrixWorld);
  const frontAt = (x, y) => {
    if (body) {
      ray.set(neck.localToWorld(new THREE.Vector3(x, y, 2)), direction);
      const hit = ray.intersectObject(body, false)[0];
      if (hit) {
        const z = neck.worldToLocal(hit.point).z;
        if (z > -.42) return z;
      }
    }
    const center = .19 + y * .40;
    return center - .23 * Math.pow(Math.abs(x) / .38, 1.7);
  };

  const vertices = [], indices = [], columns = 8;
  const rows = [
    { y: .045, half: .38, droop: .085 },
    { y: -.055, half: .34, droop: .050 },
    { y: -.15, half: .285, droop: .035 },
    { y: -.25, half: .215, droop: .020 },
    { y: -.37, half: .13, droop: .010 },
  ];
  for (let row = 0; row < rows.length; row++) {
    const { y, half, droop } = rows[row];
    for (let col = 0; col <= columns; col++) {
      const s = col / columns * 2 - 1, x = s * half, py = y + Math.abs(s) * droop;
      const crease = .018 * Math.cos(s * Math.PI * 2) * (1 - row / rows.length);
      vertices.push([x, py, frontAt(x, py) + .070 + crease]);
    }
  }
  for (let row = 0; row < rows.length - 1; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const tip = vertices.length; vertices.push([0, -.54, frontAt(0, -.54) + .075]);
  const last = (rows.length - 1) * (columns + 1);
  for (let col = 0; col < columns; col++) indices.push(last + col, tip, last + col + 1);
  mesh(vertices, indices, 'Bandana triangular cloth');

  // A complete rolled top fold. Its middle row stands proud by only 0.018;
  // the generous width reads as folded fabric rather than an orange cord.
  const band = [], bandFaces = [], sectors = 20;
  for (let row = 0; row < 3; row++) for (let i = 0; i < sectors; i++) {
    const a = i / sectors * Math.PI * 2, radius = row === 1 ? .375 : .357;
    band.push([Math.cos(a) * radius, .175 - row * .052 - (Math.sin(a) + 1) * .033, -.105 + Math.sin(a) * radius]);
  }
  for (let row = 0; row < 2; row++) for (let i = 0; i < sectors; i++) {
    const a = row * sectors + i, b = row * sectors + (i + 1) % sectors;
    bandFaces.push(a, a + sectors, b, b, a + sectors, b + sectors);
  }
  mesh(band, bandFaces, 'Bandana folded neck wrap', 0xffe1bd);

  const knot = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), cloth);
  knot.name = 'Bandana side knot'; knot.position.set(-.365, .13, -.005); knot.scale.set(.10, .085, .080); knot.castShadow = true; wrap.add(knot);
  const tails = new THREE.Group(); tails.name = 'Bandana fluttering tails'; tails.position.copy(knot.position); wrap.add(tails);
  const ribbon = (points, triangles, name, tint) => {
    const result = mesh(points, triangles, name, tint); tails.add(result); return result;
  };
  ribbon([[0,.025,.01],[-.34,.20,-.055],[-.29,.05,-.025],[-.13,-.02,.05],[-.015,-.045,.06]], [0,1,2,0,2,3,0,3,4], 'Bandana upper ribbon', 0xffe8c8);
  ribbon([[.015,-.02,.02],[-.20,-.11,.055],[-.40,-.28,.095],[-.27,-.29,.08],[-.11,-.23,.045],[-.02,-.075,.075]], [0,1,5,1,2,3,1,3,4,1,4,5], 'Bandana lower ribbon', 0xffd3a6);
  return tails;
}
