/**
 * Mẫu nhà thờ kiểu Gothic (phong cách phổ biến ở Việt Nam: Nhà thờ Lớn Hà Nội,
 * Nhà thờ Đức Bà, Phát Diệm...): hai tháp chuông mặt tiền, mái dốc, cửa vòm,
 * cửa sổ kính màu, bên trong có hàng ghế, cột và gian cung thánh.
 *
 * Kích thước và hướng lấy theo mặt bằng toà nhà thật nếu có.
 */
import * as THREE from 'three';
import { archFrameGeometry, archGeometry, Builder, gableGeometry, gableRoofGeometry } from '../builder';
import { fitTemplate } from '../placement';
import { rectRing } from '../collision';
import { blockTexture, noiseTexture, rng, roofTexture, stainedGlassTexture, tileTexture } from '../textures';
import type { TemplateInput, TemplateResult } from './types';

export function buildChurch(input: TemplateInput): TemplateResult {
  const fit = fitTemplate(input.site, { length: 48, width: 20 }, { minL: 30, maxL: 80, minW: 15, maxW: 34 });
  const L = fit.length;
  const W = fit.width;
  const b = new Builder(fit, input.collisions, input.occluders);
  const rand = rng(input.seed);

  // Hai tông màu thường gặp: đá xám (Nhà thờ Lớn HN) hoặc gạch đỏ (Đức Bà SG).
  const brick = rand() < 0.5;
  const wallColor = brick ? '#b5574a' : '#a8a296';
  const stone = new THREE.MeshStandardMaterial({ map: blockTexture(wallColor, brick ? 10 : 6, brick ? 4 : 3, 'rgba(60,50,40,0.35)', input.seed), roughness: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ map: noiseTexture(brick ? '#e9e1d2' : '#cfc9bd', 0.05, input.seed + 1), roughness: 0.85 });
  const roof = new THREE.MeshStandardMaterial({ map: roofTexture(brick ? '#5a5f66' : '#4e5560', input.seed + 2), roughness: 0.8, side: THREE.DoubleSide });
  const inner = new THREE.MeshStandardMaterial({ map: noiseTexture('#efe6d4', 0.04, input.seed + 3), roughness: 0.95 });
  const floor = new THREE.MeshStandardMaterial({ map: tileTexture('#d9cfbe', '#8f7f6a', 4), roughness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4128', roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ map: stainedGlassTexture(input.seed), emissive: '#ffffff', emissiveMap: stainedGlassTexture(input.seed), emissiveIntensity: 0.55, roughness: 0.3, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: '#22201d', roughness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d4a63a', metalness: 0.8, roughness: 0.3, emissive: '#3a2a00' });
  const red = new THREE.MeshStandardMaterial({ color: '#8c1c1c', roughness: 0.9 });

  const t = 0.7; // độ dày tường
  const T = Math.min(W * 0.3, 8); // cạnh tháp chuông
  const Hw = Math.min(16, Math.max(10, W * 0.62)); // chiều cao tường
  const rise = W * 0.42; // độ cao mái
  const Ht = Math.max(Hw + rise + 6, Math.min(L * 0.55, 38)); // chiều cao thân tháp
  const front = L / 2;
  const back = -L / 2;
  const naveFront = front - T; // tường ngăn giữa tiền sảnh và lòng nhà thờ
  const doorW = Math.min(3.6, W - 2 * T - 2);
  const doorH = Math.min(6.5, Hw * 0.55);

  // --- Mặt tiền giữa hai tháp, có cửa chính ---
  b.wallX(-W / 2 + T, W / 2 - T, front - t / 2, Hw, t, stone, [{ x: 0, w: doorW, h: doorH }]);
  // Khung vòm cửa chính + ô kính bán nguyệt phía trên cửa.
  b.mesh(archFrameGeometry(doorW, doorH, 0.6), trim, [0, 0, front + 0.03], { castShadow: false });
  const tympanum = new THREE.Mesh(new THREE.CircleGeometry(doorW / 2, 24, 0, Math.PI), glass);
  tympanum.position.set(0, doorH, front + 0.02);
  b.group.add(tympanum);
  // Cửa hoa hồng (rose window).
  const rose = new THREE.Mesh(new THREE.CircleGeometry(Math.min(2.6, (W - 2 * T) * 0.3), 32), glass);
  rose.position.set(0, Math.max(doorH + doorW / 2 + 1.2 + rose.geometry.parameters.radius, (Hw + doorH) / 2 + 1), front + 0.05);
  b.group.add(rose);
  const rose2 = rose.clone();
  rose2.position.z = front - t - 0.05;
  rose2.rotation.y = Math.PI;
  b.group.add(rose2);
  // Đầu hồi tam giác phía trước và phía sau.
  b.mesh(gableGeometry(W - 2 * T, rise), stone, [0, Hw, front], { occlude: true });
  const backGable = b.mesh(gableGeometry(W, rise), stone, [0, Hw, back], { occlude: true });
  backGable.rotation.y = Math.PI;
  b.mesh(gableGeometry(W, rise), inner, [0, Hw, back + t / 2 + 0.01], { castShadow: false });

  // --- Hai tháp chuông ---
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - T / 2);
    const z = front - T / 2;
    b.box(T, Ht, T, x, 0, z, stone);
    // Gờ ngang chia tầng tháp.
    for (const y of [Hw * 0.55, Hw, Ht - 6.5, Ht]) b.box(T + 0.5, 0.45, T + 0.5, x, y - 0.45, z, trim, { collide: false });
    // Cửa sổ tầng chuông (4 mặt).
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const win = new THREE.Mesh(archGeometry(T * 0.38, 4.2), dark);
      win.position.set(x + Math.sin(a) * (T / 2 + 0.03), Ht - 5.6, z + Math.cos(a) * (T / 2 + 0.03));
      win.rotation.y = a;
      b.group.add(win);
    }
    // Cửa sổ kính màu thân tháp, mặt trước.
    const tw = new THREE.Mesh(archGeometry(T * 0.3, 3.4), glass);
    tw.position.set(x, Hw * 0.55 + 1.2, front + 0.04);
    b.group.add(tw);
    // Chóp nhọn + thánh giá.
    const spireH = T * 1.9;
    const spire = b.mesh(new THREE.ConeGeometry(T * 0.62, spireH, 4), roof, [x, Ht + spireH / 2, z]);
    spire.rotation.y = Math.PI / 4;
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.mesh(new THREE.ConeGeometry(0.35, 2.2, 4), trim, [x + (cx * T) / 2.3, Ht + 1.1, z + (cz * T) / 2.3]);
    }
    b.mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), gold, [x, Ht + spireH + 1.2, z]);
    b.mesh(new THREE.BoxGeometry(1.2, 0.18, 0.18), gold, [x, Ht + spireH + 1.7, z]);
  }

  // --- Thân nhà thờ ---
  b.wallZ(back, naveFront + T, -W / 2 + t / 2, Hw, t, stone);
  b.wallZ(back, naveFront + T, W / 2 - t / 2, Hw, t, stone);
  b.wallX(-W / 2, W / 2, back + t / 2, Hw, t, stone);
  // Mặt trong tường (màu vữa sáng) để bên trong không tối như bên ngoài.
  const innerW = W - 2 * t;
  const innerL = naveFront - back - t;
  for (const s of [-1, 1]) {
    b.mesh(new THREE.PlaneGeometry(innerL, Hw), inner, [s * (W / 2 - t - 0.01), Hw / 2, (naveFront + back + t) / 2], { rotY: (-s * Math.PI) / 2, castShadow: false });
  }
  b.mesh(new THREE.PlaneGeometry(innerW, Hw), inner, [0, Hw / 2, back + t + 0.01], { castShadow: false });

  // Mái chính + trần.
  const roofMesh = b.mesh(gableRoofGeometry(W + 1.4, rise, L - T + 1.2), roof, [0, Hw, (back + front - T) / 2 - 0.2], { occlude: true });
  roofMesh.castShadow = true;
  const ceiling = b.mesh(new THREE.PlaneGeometry(innerW, innerL), inner, [0, Hw - 0.02, (naveFront + back + t) / 2], { castShadow: false });
  ceiling.rotation.x = Math.PI / 2;
  // Mái phần tiền sảnh giữa hai tháp.
  b.mesh(gableRoofGeometry(W - 2 * T + 0.4, rise, T + 0.2), roof, [0, Hw, front - T / 2], { occlude: true });

  // Cửa sổ kính màu hai bên + trụ áp tường.
  const bays = Math.max(3, Math.floor((naveFront - back - 6) / 5));
  const step = (naveFront - back - 6) / bays;
  for (let i = 0; i < bays; i++) {
    const z = back + 4 + step * (i + 0.5);
    for (const s of [-1, 1]) {
      const out = new THREE.Mesh(archGeometry(1.6, Hw * 0.55), glass);
      out.position.set(s * (W / 2 + 0.03), Hw * 0.28, z);
      out.rotation.y = (s * Math.PI) / 2;
      b.group.add(out);
      const inn = out.clone();
      inn.position.x = s * (W / 2 - t - 0.03);
      inn.rotation.y = (-s * Math.PI) / 2;
      b.group.add(inn);
      // Trụ bổ tường bên ngoài.
      b.box(0.9, Hw * 0.85, 1.1, s * (W / 2 + 0.45), 0, z + step / 2, stone);
      // Cột bên trong.
      if (i < bays - 1) b.mesh(new THREE.CylinderGeometry(0.38, 0.45, Hw, 12), trim, [s * (W / 2 - t - 1.1), Hw / 2, z + step / 2], { occlude: false });
    }
  }
  // Cột làm vật cản.
  for (let i = 0; i < bays - 1; i++) {
    const z = back + 4 + step * (i + 1);
    for (const s of [-1, 1]) b.collider(s * (W / 2 - t - 1.1), z, 0.9, 0.9);
  }

  // --- Bên trong ---
  b.mesh(new THREE.PlaneGeometry(innerW, innerL), floor, [0, 0.02, (naveFront + back + t) / 2], { castShadow: false }).rotation.x = -Math.PI / 2;
  // Thảm đỏ lối giữa.
  b.mesh(new THREE.PlaneGeometry(1.8, innerL - 9), red, [0, 0.03, (naveFront + back + t) / 2 + 3.5], { castShadow: false }).rotation.x = -Math.PI / 2;

  // Hàng ghế hai bên lối đi.
  const aisle = 1.6;
  const pewW = Math.max(2.5, W / 2 - t - aisle - 2.2);
  const pewStart = naveFront - 3;
  const pewEnd = back + t + 9;
  const rows = Math.max(3, Math.floor((pewStart - pewEnd) / 1.15));
  for (const s of [-1, 1]) {
    const cx = s * (aisle + pewW / 2);
    for (let r = 0; r < rows; r++) {
      const z = pewStart - r * 1.15;
      b.box(pewW, 0.45, 0.45, cx, 0, z, wood, { collide: false, occlude: false });
      b.box(pewW, 0.55, 0.08, cx, 0.45, z + 0.22, wood, { collide: false, occlude: false });
    }
    const lastZ = pewStart - (rows - 1) * 1.15;
    b.collider(cx, (pewStart + lastZ) / 2 + 0.1, pewW, pewStart - lastZ + 0.6);
  }

  // Cung thánh: bậc, bàn thờ, thánh giá, nến.
  const sanct = back + t + 4;
  b.box(innerW - 0.2, 0.25, 7, 0, 0, back + t + 3.5, floor, { collide: false, occlude: false });
  b.box(3.6, 1.05, 1.3, 0, 0.25, sanct, trim, { occlude: false });
  b.box(3.8, 0.05, 1.4, 0, 1.3, sanct, new THREE.MeshStandardMaterial({ color: '#f4f1ea' }), { collide: false, occlude: false });
  b.box(0.3, 5.5, 0.3, 0, 1.5, back + t + 0.4, gold, { collide: false, occlude: false });
  b.box(2.6, 0.3, 0.3, 0, 5.2, back + t + 0.4, gold, { collide: false, occlude: false });
  const flame = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 3 });
  for (const x of [-1.3, -0.6, 0.6, 1.3]) {
    b.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), trim, [x, 1.6, sanct], { castShadow: false });
    b.mesh(new THREE.SphereGeometry(0.06, 8, 6), flame, [x, 1.9, sanct], { castShadow: false });
  }
  // Ánh sáng trong nhà thờ.
  const warm = (x: number, y: number, z: number, i: number, d: number) => {
    const l = new THREE.PointLight('#ffd9a0', i, d, 1.6);
    l.position.set(x, y, z);
    b.group.add(l);
  };
  warm(0, 2.5, sanct + 1.5, 30, 14);
  warm(0, Hw - 2, (naveFront + back) / 2, 60, Math.max(L, 30));
  warm(0, Hw - 2, naveFront - 3, 30, 20);

  // Biển tên phía trên cửa.
  b.sign(input.name, [0, doorH + 0.9, front + 0.12], 0.9, 0, { bg: '#2c2a26', color: '#f1dca7', border: '#c9a24a' });

  // Sân trước nhà thờ.
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 12, 18),
    new THREE.MeshStandardMaterial({ map: blockTexture('#c9c2b4', 8, 8, 'rgba(0,0,0,0.12)', 5), roughness: 0.95 }),
  );
  (plaza.material as THREE.MeshStandardMaterial).map!.repeat.set((W + 12) / 3, 6);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.015, front + 9);
  plaza.receiveShadow = true;
  b.group.add(plaza);

  const pad = 3;
  const footprint = [
    [-W / 2 - pad, back - pad],
    [W / 2 + pad, back - pad],
    [W / 2 + pad, front + 18],
    [-W / 2 - pad, front + 18],
  ].map((p) => b.toWorld(p as [number, number]));
  const [sx, sz] = b.toWorld([0, front + 9]);
  return {
    group: b.group,
    spawn: { x: sx, z: sz, facing: b.toWorldAngle(Math.PI) },
    footprint,
    interior: [
      [-W / 2, back],
      [W / 2, back],
      [W / 2, front],
      [-W / 2, front],
    ].map((p) => b.toWorld(p as [number, number])),
    floors: [{ ring: rectRing(0, back + t + 3.5, innerW - 0.2, 7).map((p) => b.toWorld(p)), y: 0.25 }],
  };
}
