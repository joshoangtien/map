/**
 * Mẫu chùa / đình / đền Việt Nam: cổng tam quan, sân lát gạch, chính điện
 * mái ngói hai tầng có đầu đao cong, hàng cột đỏ phía trước, bên trong có
 * tượng Phật (chùa) hoặc ban thờ (đình, đền), hương án và đèn lồng; bên cạnh có tháp.
 */
import * as THREE from 'three';
import { Builder } from '../builder';
import { rectRing } from '../collision';
import { fitTemplate } from '../placement';
import { blockTexture, noiseTexture, roofTexture, tileTexture } from '../textures';
import type { TemplateInput, TemplateResult } from './types';

/** Mái hông (bốn mái) dạng chóp cụt: đáy w×d, đỉnh thu nhỏ theo tỉ lệ k. */
function hipRoof(w: number, d: number, h: number, k: number) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * k, Math.SQRT1_2, h, 4, 1, false);
  g.rotateY(Math.PI / 4);
  g.scale(w, 1, d);
  // UV theo mét.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / 2, pos.getY(i) / 1.2);
  return g;
}

export function buildPagoda(input: TemplateInput): TemplateResult {
  const isBuddhist = /chùa|thiền|tịnh xá|tu viện|pagoda/i.test(`${input.kind} ${input.name}`);
  // Chính điện của chùa Việt rộng ngang, sâu ít: mặt tiền nằm ở cạnh dài.
  const fit = fitTemplate(input.site, { length: 12, width: 18 }, { minL: 9, maxL: 22, minW: 12, maxW: 34 }, true);
  const W = fit.width;
  const D = Math.min(fit.length, W * 0.8);
  const b = new Builder(fit, input.collisions, input.occluders);

  const wall = new THREE.MeshStandardMaterial({ map: noiseTexture('#e8c46a', 0.05, input.seed), roughness: 0.9 });
  const redWood = new THREE.MeshStandardMaterial({ color: '#8e1f17', roughness: 0.6 });
  const roof = new THREE.MeshStandardMaterial({ map: roofTexture('#7a3b2a', input.seed + 1), roughness: 0.85, side: THREE.DoubleSide });
  const stone = new THREE.MeshStandardMaterial({ map: blockTexture('#9a958b', 4, 2, 'rgba(0,0,0,0.25)', input.seed + 2), roughness: 0.95 });
  const brickFloor = new THREE.MeshStandardMaterial({ map: tileTexture('#a6503a', '#b45e46', 6), roughness: 0.9 });
  const inner = new THREE.MeshStandardMaterial({ map: noiseTexture('#5a2a1c', 0.05, input.seed + 3), roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d9a93a', metalness: 0.7, roughness: 0.35, emissive: '#4a3000', emissiveIntensity: 0.6 });
  const lantern = new THREE.MeshStandardMaterial({ color: '#e0352b', emissive: '#ff4a2a', emissiveIntensity: 1.4 });

  const H = 5.2; // chiều cao cột / tường
  const t = 0.5;
  const front = D / 2;
  const back = -D / 2;
  const porch = 2.6; // hiên phía trước, hàng cột ngoài cùng

  // --- Nền chính điện (thấp, chỉ để nhìn; không chặn bước đi) ---
  b.box(W + 2, 0.18, D + porch + 1.2, 0, 0, (porch + 1.2) / 2 - 0.3, stone, { collide: false, occlude: false });

  // --- Tường hồi và tường hậu ---
  b.wallX(-W / 2, W / 2, back + t / 2, H, t, wall);
  b.wallZ(back, front, -W / 2 + t / 2, H, t, wall);
  b.wallZ(back, front, W / 2 - t / 2, H, t, wall);
  // Mặt tiền: các khoang cửa mở giữa các cột.
  const bays = Math.max(3, Math.round(W / 4) | 1);
  const bay = W / bays;
  for (let i = 0; i <= bays; i++) {
    const x = -W / 2 + i * bay;
    b.mesh(new THREE.CylinderGeometry(0.28, 0.32, H, 12), redWood, [x, H / 2, front], { occlude: false });
    b.collider(x, front, 0.6, 0.6);
    // Hàng cột hiên.
    b.mesh(new THREE.CylinderGeometry(0.24, 0.28, H - 0.6, 12), redWood, [x, (H - 0.6) / 2, front + porch], { occlude: false });
    b.collider(x, front + porch, 0.5, 0.5);
  }
  // Xà ngang và câu đầu.
  b.box(W + 0.4, 0.5, 0.4, 0, H - 0.5, front, redWood, { collide: false, occlude: false });
  b.box(W + 0.4, 0.4, 0.35, 0, H - 1.0, front + porch, redWood, { collide: false, occlude: false });

  // Mặt trong tường (màu gỗ sẫm).
  b.mesh(new THREE.PlaneGeometry(W - 2 * t, H), inner, [0, H / 2, back + t + 0.01], { castShadow: false });
  for (const s of [-1, 1]) b.mesh(new THREE.PlaneGeometry(D - t, H), inner, [s * (W / 2 - t - 0.01), H / 2, t / 2], { rotY: (-s * Math.PI) / 2, castShadow: false });
  // Sàn.
  b.mesh(new THREE.PlaneGeometry(W - 2 * t, D - t), brickFloor, [0, 0.2, t / 2], { castShadow: false }).rotation.x = -Math.PI / 2;
  // Trần.
  b.mesh(new THREE.PlaneGeometry(W, D + porch), inner, [0, H - 0.01, porch / 2], { castShadow: false }).rotation.x = Math.PI / 2;

  // --- Mái hai tầng (chồng diêm) ---
  const r1 = b.mesh(hipRoof(W + 3.2, D + porch + 3.2, 2.2, 0.7), roof, [0, H + 1.1, porch / 2], { occlude: true });
  r1.castShadow = true;
  b.box(W * 0.62, 1.1, (D + porch) * 0.55, 0, H + 2.2, porch / 2, wall, { collide: false, occlude: false });
  b.mesh(hipRoof(W * 0.75 + 1.6, (D + porch) * 0.6 + 1.6, 2.4, 0.08), roof, [0, H + 3.3 + 1.2, porch / 2], { occlude: true });
  // Bờ nóc + đầu đao cong.
  b.box(W * 0.3, 0.35, 0.35, 0, H + 3.3 + 2.35, porch / 2, roof, { collide: false, occlude: false });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (const [lvl, ww, dd, y] of [
      [0, W + 3.2, D + porch + 3.2, H],
      [1, W * 0.75 + 1.6, (D + porch) * 0.6 + 1.6, H + 3.3],
    ] as const) {
      const tip = b.mesh(new THREE.ConeGeometry(0.18, 1.4, 6), roof, [(sx * ww) / 2, y + 0.55, porch / 2 + (sz * dd) / 2], { castShadow: lvl === 0 });
      tip.rotation.z = -sx * 0.9;
      tip.rotation.x = sz * 0.9;
    }
  }
  // Hai con giống / rồng chầu đơn giản trên nóc: viên ngọc giữa.
  b.mesh(new THREE.SphereGeometry(0.4, 16, 12), gold, [0, H + 3.3 + 2.9, porch / 2]);

  // --- Bên trong: ban thờ ---
  const altarZ = back + t + 1.6;
  b.box(W * 0.5, 1.3, 1.6, 0, 0.2, altarZ, redWood, { occlude: false });
  b.box(W * 0.3, 0.9, 1.1, 0, 0.2, altarZ + 1.8, redWood, { occlude: false }); // hương án
  b.mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.4, 16), gold, [0, 1.3, altarZ + 1.8]); // bát hương
  if (isBuddhist) {
    // Tượng Phật ngồi trên toà sen.
    const y = 1.5;
    b.mesh(new THREE.CylinderGeometry(0.9, 0.7, 0.5, 16), gold, [0, y + 0.25, altarZ]);
    b.mesh(new THREE.SphereGeometry(0.85, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), gold, [0, y + 0.5, altarZ]).scale.set(1.1, 0.5, 0.9);
    b.mesh(new THREE.CapsuleGeometry(0.55, 0.7, 6, 16), gold, [0, y + 1.35, altarZ]);
    b.mesh(new THREE.SphereGeometry(0.36, 20, 16), gold, [0, y + 2.15, altarZ]);
    b.mesh(new THREE.SphereGeometry(0.16, 12, 10), gold, [0, y + 2.5, altarZ]);
    b.mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 32), gold, [0, y + 2.15, altarZ - 0.2], { castShadow: false });
  } else {
    // Đình/đền: khám thờ và hoành phi.
    b.box(1.6, 2.2, 1.0, 0, 1.5, altarZ - 0.1, gold, { collide: false, occlude: false });
    b.box(2.0, 0.25, 1.2, 0, 3.7, altarZ - 0.1, redWood, { collide: false, occlude: false });
  }
  b.sign(input.name, [0, H - 0.85, front + 0.25], 0.75, 0, { bg: '#1b1a17', color: '#f3c860', border: '#b8892c' });

  // Đèn lồng đỏ dưới hiên.
  for (let i = 0; i < bays; i++) {
    const x = -W / 2 + (i + 0.5) * bay;
    b.mesh(new THREE.SphereGeometry(0.32, 14, 10), lantern, [x, H - 1.6, front + porch / 2], { castShadow: false }).scale.y = 1.25;
  }
  const lamp = (x: number, y: number, z: number, i: number, d: number) => {
    const l = new THREE.PointLight('#ffcf8a', i, d, 1.6);
    l.position.set(x, y, z);
    b.group.add(l);
  };
  lamp(0, H - 1, altarZ + 2.5, 70, 14);
  lamp(0, 3.2, altarZ + 0.9, 25, 5);
  lamp(0, H - 1.5, front + porch / 2, 15, 10);

  // --- Sân và cổng tam quan ---
  const yard = 16;
  const yardZ = front + porch + yard / 2;
  const yardMesh = new THREE.Mesh(new THREE.PlaneGeometry(W + 10, yard), brickFloor.clone());
  const ym = (yardMesh.material as THREE.MeshStandardMaterial).map!.clone();
  ym.repeat.set((W + 10) / 3, yard / 3);
  (yardMesh.material as THREE.MeshStandardMaterial).map = ym;
  yardMesh.rotation.x = -Math.PI / 2;
  yardMesh.position.set(0, 0.02, yardZ);
  yardMesh.receiveShadow = true;
  b.group.add(yardMesh);

  const gateZ = front + porch + yard;
  const gw = Math.min(W, 13);
  for (const x of [-gw / 2, -gw / 6, gw / 6, gw / 2]) {
    b.box(0.8, 4.4, 0.8, x, 0, gateZ, stone);
    b.mesh(new THREE.SphereGeometry(0.35, 10, 8), stone, [x, 4.7, gateZ]);
  }
  b.mesh(hipRoof(gw / 3 + 1.6, 2.2, 1.1, 0.4), roof, [0, 5.1, gateZ]);
  for (const s of [-1, 1]) b.mesh(hipRoof(gw / 3 + 0.8, 1.8, 0.8, 0.4), roof, [(s * gw) / 3, 4.3, gateZ]);
  b.box(gw / 3 - 0.8, 0.5, 0.3, 0, 3.8, gateZ, redWood, { collide: false, occlude: false });
  // Tường bao hai bên cổng.
  for (const s of [-1, 1]) b.box((W + 10 - gw) / 2, 1.6, 0.4, (s * (gw + (W + 10 - gw) / 2)) / 2, 0, gateZ, wall, { occlude: false });

  // --- Tháp nhiều tầng bên cạnh sân ---
  const tx = W / 2 + 2.5;
  const tz = front + porch + yard * 0.45;
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const s = 2.2 - i * 0.3;
    const h = 1.6 - i * 0.1;
    b.box(s, h, s, tx, y, tz, i === 0 ? stone : wall, { collide: i === 0, occlude: false });
    b.mesh(hipRoof(s + 0.9, s + 0.9, 0.5, 0.6), roof, [tx, y + h + 0.25, tz]);
    y += h + 0.5;
  }
  b.mesh(new THREE.ConeGeometry(0.25, 1.4, 8), gold, [tx, y + 0.7, tz]);

  const footprint = [
    [-W / 2 - 4, back - 3],
    [W / 2 + 6, back - 3],
    [W / 2 + 6, gateZ + 2],
    [-W / 2 - 4, gateZ + 2],
  ].map((p) => b.toWorld(p as [number, number]));
  const [sx, sz] = b.toWorld([0, gateZ + 4]);
  return {
    group: b.group,
    spawn: { x: sx, z: sz, facing: b.toWorldAngle(Math.PI) },
    footprint,
    interior: [
      [-W / 2, back],
      [W / 2, back],
      [W / 2, front + porch],
      [-W / 2, front + porch],
    ].map((p) => b.toWorld(p as [number, number])),
    floors: [{ ring: rectRing(0, (porch + 1.2) / 2 - 0.3, W + 2, D + porch + 1.2).map((p) => b.toWorld(p)), y: 0.2 }],
  };
}
