/**
 * Mẫu chung cho các địa điểm khác (quán, trường, bệnh viện...):
 * dựng đúng hình mặt bằng thật của toà nhà, có cửa sổ, mái hiên và biển hiệu.
 * Chưa có nội thất: người chơi đi quanh bên ngoài.
 */
import * as THREE from 'three';
import { Builder } from '../builder';
import { dist, distToPolyline, pointInRing, type XZ } from '../geo';
import { rectRing } from '../collision';
import { facadeTexture, PASTELS, rng } from '../textures';
import type { TemplateInput, TemplateResult } from './types';

export function buildGeneric(input: TemplateInput): TemplateResult {
  const { site } = input;
  const rand = rng(input.seed);
  const ring: XZ[] = site.target?.ring ?? rectRing(0, 0, 14, 10);
  const height = Math.max(4, Math.min(60, site.target?.height ?? 8));

  const b = new Builder({ x: 0, z: 0, rotY: 0 }, input.collisions, input.occluders);
  const color = PASTELS[Math.floor(rand() * PASTELS.length)];
  const facade = new THREE.MeshStandardMaterial({ map: facadeTexture(color, input.seed), roughness: 0.9 });
  const top = new THREE.MeshStandardMaterial({ color: '#9b958c', roughness: 0.95 });

  const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, [top, facade]);
  m.castShadow = m.receiveShadow = true;
  b.group.add(m);
  input.occluders.push(m);
  b.colliderRing(ring);

  // Mặt tiền: điểm trên chu vi gần đường nhất.
  let entry: XZ = ring[0];
  let normal: XZ = [0, 1];
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const c = ring[(i + 1) % ring.length];
    const mid: XZ = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
    const len = dist(a, c);
    if (len < 3) continue;
    const d = site.roads.length ? site.roads.reduce((mm, r) => Math.min(mm, distToPolyline(mid, r.line)), Infinity) : -len;
    if (d < best) {
      best = d;
      entry = mid;
      // Pháp tuyến hướng ra ngoài.
      let n: XZ = [(c[1] - a[1]) / len, -(c[0] - a[0]) / len];
      if (pointInRing([mid[0] + n[0] * 0.5, mid[1] + n[1] * 0.5], ring)) n = [-n[0], -n[1]];
      normal = n;
    }
  }
  const facing = Math.atan2(normal[0], normal[1]);

  // Cửa ra vào, mái hiên và biển hiệu.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshStandardMaterial({ color: '#3a2e25', roughness: 0.6 }));
  door.position.set(entry[0] + normal[0] * 0.03, 1.3, entry[1] + normal[1] * 0.03);
  door.rotation.y = facing;
  b.group.add(door);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 1.4), new THREE.MeshStandardMaterial({ color: ['#b8322a', '#2a6fb8', '#2f8a4a'][Math.floor(rand() * 3)] }));
  awning.position.set(entry[0] + normal[0] * 0.7, 3.0, entry[1] + normal[1] * 0.7);
  awning.rotation.y = facing;
  awning.castShadow = true;
  b.group.add(awning);
  b.sign(input.name, [entry[0] + normal[0] * 0.08, 3.7, entry[1] + normal[1] * 0.08], 0.8, facing);

  const spawn: XZ = [entry[0] + normal[0] * 6, entry[1] + normal[1] * 6];
  const pad = 2;
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  const footprint: XZ[] = [
    [Math.min(...xs) - pad, Math.min(...zs) - pad],
    [Math.max(...xs) + pad, Math.min(...zs) - pad],
    [Math.max(...xs) + pad, Math.max(...zs) + pad],
    [Math.min(...xs) - pad, Math.max(...zs) + pad],
  ];
  return { group: b.group, spawn: { x: spawn[0], z: spawn[1], facing: facing + Math.PI }, footprint };
}
