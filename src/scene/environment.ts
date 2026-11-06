/**
 * Môi trường quanh địa điểm, dựng từ dữ liệu bản đồ thật:
 * mặt đất, đường, nhà xung quanh (có va chạm), mặt nước, bãi cỏ và cây.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CollisionWorld } from './collision';
import { distToPolyline, pointInRing, ringCentroid, type SiteArea, type SiteData, type XZ } from './geo';
import { facadeTexture, noiseTexture, PASTELS, rng } from './textures';

export interface EnvironmentInput {
  site: SiteData;
  collisions: CollisionWorld;
  occluders: THREE.Object3D[];
  /** Vùng công trình chính chiếm chỗ: bỏ nhà và cây trong vùng này. */
  footprint: XZ[];
  seed: number;
}

function areaGeometry(a: SiteArea, y: number) {
  const shape = new THREE.Shape(a.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of a.holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  // UV theo mét.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 4, pos.getZ(i) / 4);
  return g;
}

/** Dải đường phẳng theo một polyline, nối các khúc bằng hình tròn. */
function ribbon(line: XZ[], width: number, y: number) {
  const parts: THREE.BufferGeometry[] = [];
  const hw = width / 2;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const nx = (-(bz - az) / len) * hw;
    const nz = ((bx - ax) / len) * hw;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz], 3),
    );
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, len / 4, 0, len / 4, 1, 0, 1], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    parts.push(g);
  }
  for (const [x, z] of line.slice(1, -1)) {
    const c = new THREE.CircleGeometry(hw, 12);
    c.rotateX(-Math.PI / 2);
    c.translate(x, y, z);
    parts.push(c);
  }
  return parts;
}

function merge(parts: THREE.BufferGeometry[]) {
  if (!parts.length) return null;
  // mergeGeometries cần tất cả cùng có (hoặc cùng không có) index.
  const norm = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  return mergeGeometries(norm, false);
}

/** Cây nhiệt đới đơn giản (thân + tán), vẽ bằng InstancedMesh cho nhẹ. */
function trees(points: XZ[], seed: number) {
  const group = new THREE.Group();
  if (!points.length) return group;
  const rand = rng(seed);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 1 }), points.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }), points.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const greens = ['#4f8a3a', '#5e9a44', '#3f7a35', '#6aa34d', '#4a7f3b'].map((c) => new THREE.Color(c));
  points.forEach(([x, z], i) => {
    const h = 3 + rand() * 4;
    const r = 1.6 + rand() * 1.6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    trunks.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, h, 1)));
    crowns.setMatrixAt(i, m.compose(new THREE.Vector3(x, h + r * 0.55, z), q, new THREE.Vector3(r, r * 0.85, r)));
    crowns.setColorAt(i, greens[Math.floor(rand() * greens.length)]);
  });
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  group.add(trunks, crowns);
  return group;
}

export function buildEnvironment({ site, collisions, occluders, footprint, seed }: EnvironmentInput) {
  const group = new THREE.Group();
  const rand = rng(seed + 99);
  const R = site.radius;
  const inFootprint = (p: XZ) => pointInRing(p, footprint);

  // --- Mặt đất ---
  const groundTex = noiseTexture('#a7a38f', 0.05, seed, 2600);
  groundTex.repeat.set((R * 3) / 6, (R * 3) / 6);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R * 1.5, 64), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // --- Cỏ, công viên ---
  const grassTex = noiseTexture('#7fa65a', 0.07, seed + 1, 3000);
  const grassGeo = merge(site.green.map((a) => areaGeometry(a, 0.008)));
  if (grassGeo) {
    const g = new THREE.Mesh(grassGeo, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
    g.receiveShadow = true;
    group.add(g);
  }

  // --- Mặt nước (không đi xuống được) ---
  const waterGeo = merge(site.water.map((a) => areaGeometry(a, 0.03)));
  if (waterGeo) {
    const w = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: '#4f8fb8', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 }));
    w.receiveShadow = true;
    w.userData.water = true;
    group.add(w);
    for (const a of site.water) collisions.add(a.ring);
  }

  // --- Đường ---
  const roadTex = noiseTexture('#4b4b4d', 0.04, seed + 2, 1500);
  const pathTex = noiseTexture('#c2b29a', 0.06, seed + 3, 1500);
  const isPath = (k: string) => ['path', 'track', 'pedestrian'].includes(k);
  const roadParts: THREE.BufferGeometry[] = [];
  const pathParts: THREE.BufferGeometry[] = [];
  const kerbParts: THREE.BufferGeometry[] = [];
  for (const r of site.roads) {
    if (isPath(r.kind)) pathParts.push(...ribbon(r.line, r.width, 0.02));
    else {
      kerbParts.push(...ribbon(r.line, r.width + 3, 0.012)); // vỉa hè
      roadParts.push(...ribbon(r.line, r.width, 0.025));
    }
  }
  const addFlat = (geo: THREE.BufferGeometry | null, mat: THREE.Material) => {
    if (!geo) return;
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    group.add(m);
  };
  addFlat(merge(kerbParts), new THREE.MeshStandardMaterial({ color: '#b9b2a6', roughness: 1 }));
  addFlat(merge(roadParts), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }));
  addFlat(merge(pathParts), new THREE.MeshStandardMaterial({ map: pathTex, roughness: 1 }));

  // --- Nhà xung quanh ---
  const facades = PASTELS.map((c, i) => new THREE.MeshStandardMaterial({ map: facadeTexture(c, seed + i), roughness: 0.9 }));
  const roofMat = new THREE.MeshStandardMaterial({ color: '#8f8a83', roughness: 0.95 });
  const byMat = new Map<number, THREE.BufferGeometry[]>();
  for (const bld of site.buildings) {
    if (bld === site.target) continue;
    const c = ringCentroid(bld.ring);
    if (inFootprint(c) || bld.ring.some(inFootprint)) continue;
    const shape = new THREE.Shape(bld.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of bld.holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const depth = Math.max(1, bld.height - bld.minHeight);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, bld.minHeight, 0);
    const mi = Math.floor(rand() * facades.length);
    if (!byMat.has(mi)) byMat.set(mi, []);
    byMat.get(mi)!.push(g);
    if (bld.minHeight < 2) collisions.add(bld.ring);
  }
  for (const [mi, geos] of byMat) {
    const g = mergeGeometries(geos, false);
    if (!g) continue;
    // ExtrudeGeometry có 2 nhóm vật liệu (0: mái/đáy, 1: tường). Giữ lại khi gộp.
    let offset = 0;
    for (const src of geos) {
      for (const gr of src.groups) g.addGroup(offset + gr.start, gr.count, gr.materialIndex ?? 0);
      offset += src.attributes.position.count;
    }
    const m = new THREE.Mesh(g, [roofMat, facades[mi]]);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    occluders.push(m);
  }

  // --- Cây: trong công viên/bãi cỏ và rải rác ven đường ---
  const pts: XZ[] = [];
  const nearRoad = (p: XZ, extra: number) => site.roads.some((r) => distToPolyline(p, r.line) < r.width / 2 + extra);
  const ok = (p: XZ) => Math.hypot(p[0], p[1]) < R && !inFootprint(p) && !collisions.blocked(p, 1.2) && !nearRoad(p, 0.8);
  for (const a of site.green) {
    const xs = a.ring.map((p) => p[0]);
    const zs = a.ring.map((p) => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const n = Math.min(60, Math.floor(((x1 - x0) * (z1 - z0)) / 90));
    for (let i = 0; i < n; i++) {
      const p: XZ = [x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0)];
      if (pointInRing(p, a.ring) && ok(p)) pts.push(p);
    }
  }
  // Hàng cây ven đường (cách mép đường ~2 m, mỗi 10–14 m).
  for (const r of site.roads) {
    if (r.width < 6) continue;
    for (let i = 1; i < r.line.length; i++) {
      const [ax, az] = r.line[i - 1];
      const [bx, bz] = r.line[i];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let s = 5; s < len; s += 10 + rand() * 4) {
        for (const side of [-1, 1]) {
          const off = r.width / 2 + 1.6;
          const p: XZ = [ax + ((bx - ax) * s) / len + nx * off * side, az + ((bz - az) * s) / len + nz * off * side];
          if (ok(p) || (Math.hypot(p[0], p[1]) < R && !inFootprint(p) && !collisions.blocked(p, 1.0))) pts.push(p);
        }
      }
    }
  }
  // Không có dữ liệu cây: rải ngẫu nhiên vài cây cho đỡ trống.
  if (pts.length < 12) {
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2;
      const d = 25 + rand() * (R - 30);
      const p: XZ = [Math.cos(a) * d, Math.sin(a) * d];
      if (ok(p)) pts.push(p);
    }
  }
  const treeGroup = trees(pts.slice(0, 400), seed + 5);
  group.add(treeGroup);
  // Thân cây là vật cản nhỏ.
  for (const [x, z] of pts.slice(0, 400)) {
    collisions.add([
      [x - 0.3, z - 0.3],
      [x + 0.3, z - 0.3],
      [x + 0.3, z + 0.3],
      [x - 0.3, z + 0.3],
    ]);
  }

  return group;
}
