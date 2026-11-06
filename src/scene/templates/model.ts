/**
 * Đặt model tự dựng (.glb từ Blender) vào scene.
 *
 * Quy ước đặt tên vật thể trong Blender:
 *  - `collider…` : khối va chạm (bị ẩn). Mỗi vật thể được tính bằng bao lồi
 *                  của nó nhìn từ trên xuống, nên tường có cửa phải tách thành
 *                  nhiều khối riêng hai bên cửa. Khối có đáy cao hơn 2 m bị bỏ qua.
 *  - `floor…`    : sàn/bục cao hơn mặt đất; nhân vật đứng lên mặt trên của nó (bị ẩn).
 *  - `spawn`     : điểm xuất hiện (Empty mũi tên); nhân vật nhìn theo hướng mũi tên
 *                  (trục Z cục bộ trong Blender = trục Y cục bộ trong glTF).
 * Mọi vật thể còn lại được hiển thị và che camera.
 */
import * as THREE from 'three';
import { Builder } from '../builder';
import { convexHull, makeProjector, minAreaRect, type XZ } from '../geo';
import type { ModelEntry } from '../models';
import { fitTemplate } from '../placement';
import type { TemplateInput, TemplateResult } from './types';

/** Khối va chạm có đáy cao hơn mức này (m) được bỏ qua: nhân vật đi lọt bên dưới. */
const HEAD_CLEARANCE = 2.0;

const isCollider = (o: THREE.Object3D) => /^collider/i.test(o.name);
const isFloor = (o: THREE.Object3D) => /^floor/i.test(o.name);
const isSpawn = (o: THREE.Object3D) => /^spawn/i.test(o.name);

/** Các đỉnh của một mesh trong toạ độ của `root`. */
function verticesIn(mesh: THREE.Mesh, root: THREE.Object3D): THREE.Vector3[] {
  const pos = mesh.geometry.attributes.position;
  const m = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m));
  return out;
}

export interface ModelInfo {
  /** Có khối va chạm riêng trong model không. */
  hasColliders: boolean;
  /** Kích thước model (m). */
  size: THREE.Vector3;
}

export function buildFromModel(input: TemplateInput & { model: THREE.Group; entry: ModelEntry; poiLngLat: [number, number] }): TemplateResult & { info: ModelInfo } {
  const { model, entry, site } = input;
  model.updateMatrixWorld(true);

  // --- Tách các vật thể đặc biệt ---
  const colliders: THREE.Mesh[] = [];
  const floors: THREE.Mesh[] = [];
  let spawnObj: THREE.Object3D | null = null;
  const visible: THREE.Mesh[] = [];
  model.traverse((o) => {
    if (isSpawn(o)) spawnObj = o;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Vật thể con của collider/floor cũng tính theo cha.
    let p: THREE.Object3D | null = o;
    let tag: 'collider' | 'floor' | null = null;
    while (p && p !== model) {
      if (isCollider(p)) tag = 'collider';
      else if (isFloor(p)) tag = 'floor';
      p = p.parent;
    }
    if (tag === 'collider') colliders.push(mesh);
    else if (tag === 'floor') floors.push(mesh);
    else visible.push(mesh);
  });
  for (const m of [...colliders, ...floors]) m.visible = false;
  for (const m of visible) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  // Kích thước phần nhìn thấy.
  const box = new THREE.Box3();
  for (const m of visible) box.expandByObject(m);
  if (box.isEmpty()) box.setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  // --- Vị trí và hướng ---
  let x = 0;
  let z = 0;
  let rotY = 0;
  if (entry.lngLat) {
    [x, z] = makeProjector(...input.poiLngLat).toLocal(...entry.lngLat);
  }
  if (typeof entry.facade === 'number') {
    // Hướng la bàn → vector trong scene (Bắc là -z).
    const b = (entry.facade * Math.PI) / 180;
    rotY = Math.atan2(Math.sin(b), -Math.cos(b));
    if (!entry.lngLat && site.target) {
      const r = minAreaRect(site.target.ring);
      if (r) [x, z] = r.center;
    }
  } else {
    // Tự xoay theo mặt bằng thật: mặt tiền (+z của model) ở cạnh ngắn nếu model sâu hơn rộng.
    const fit = fitTemplate(site, { length: size.z, width: size.x }, { minL: 0, maxL: 1e6, minW: 0, maxW: 1e6 }, size.x > size.z);
    rotY = fit.rotY;
    if (!entry.lngLat) [x, z] = [fit.x, fit.z];
  }

  const b = new Builder({ x, z, rotY }, input.collisions, input.occluders);
  for (const m of visible) input.occluders.push(m);

  // --- Va chạm ---
  if (colliders.length) {
    for (const c of colliders) {
      const vs = verticesIn(c, model);
      // Khối nằm cao hơn đầu nhân vật (vd. phần tường trên khung cửa) thì không chặn đường.
      if (Math.min(...vs.map((v) => v.y)) > HEAD_CLEARANCE) continue;
      const hull = convexHull(vs.map((v) => [v.x, v.z] as XZ));
      if (hull.length >= 3) b.colliderRing(hull);
    }
  } else {
    // Chưa có khối va chạm: coi cả model là khối đặc (không vào trong được).
    const hull = convexHull(visible.flatMap((m) => verticesIn(m, model).map((v) => [v.x, v.z] as XZ)));
    if (hull.length >= 3) b.colliderRing(hull);
    console.warn(`[model ${entry.id}] Không có vật thể "collider…": cả model được coi là khối đặc.`);
  }

  const floorZones = floors
    .map((f) => {
      const vs = verticesIn(f, model);
      const ring = convexHull(vs.map((v) => [v.x, v.z] as XZ)).map((p) => b.toWorld(p));
      return { ring, y: Math.max(...vs.map((v) => v.y)) };
    })
    .filter((f) => f.ring.length >= 3);

  // --- Điểm xuất hiện ---
  let spawn: TemplateResult['spawn'];
  const sp = spawnObj as THREE.Object3D | null;
  if (sp) {
    const p = sp.getWorldPosition(new THREE.Vector3());
    model.worldToLocal(p);
    // Mũi tên Empty chỉ theo Z cục bộ của Blender, tức Y cục bộ trong glTF.
    // Hướng nhìn = hướng mũi tên trong model (m.matrixWorld của model chưa gồm vị trí trong scene).
    const q = new THREE.Quaternion();
    sp.getWorldQuaternion(q);
    q.premultiply(model.getWorldQuaternion(new THREE.Quaternion()).invert());
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const [wx, wz] = b.toWorld([p.x, p.z]);
    // Mũi tên dựng đứng (không chỉ hướng nào trên mặt đất): nhìn về tâm công trình.
    const local = Math.hypot(dir.x, dir.z) > 0.2 ? Math.atan2(dir.x, dir.z) : Math.atan2((box.min.x + box.max.x) / 2 - p.x, (box.min.z + box.max.z) / 2 - p.z);
    spawn = { x: wx, z: wz, facing: b.toWorldAngle(local) };
  } else {
    const [wx, wz] = b.toWorld([(box.min.x + box.max.x) / 2, box.max.z + 8]);
    spawn = { x: wx, z: wz, facing: b.toWorldAngle(Math.PI) };
  }

  b.group.add(model);

  const pad = 3;
  const rect: XZ[] = [
    [box.min.x, box.min.z],
    [box.max.x, box.min.z],
    [box.max.x, box.max.z],
    [box.min.x, box.max.z],
  ];
  const padded: XZ[] = [
    [box.min.x - pad, box.min.z - pad],
    [box.max.x + pad, box.min.z - pad],
    [box.max.x + pad, box.max.z + pad],
    [box.min.x - pad, box.max.z + pad],
  ];
  return {
    group: b.group,
    spawn,
    footprint: padded.map((p) => b.toWorld(p)),
    interior: rect.map((p) => b.toWorld(p)),
    floors: floorZones,
    hasColliders: colliders.length > 0,
    info: { hasColliders: colliders.length > 0, size },
  };
}
