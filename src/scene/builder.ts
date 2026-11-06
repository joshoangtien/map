/**
 * Công cụ dựng công trình: mỗi lần thêm một khối vừa tạo mesh,
 * vừa (tuỳ chọn) đăng ký vật cản va chạm và vật che camera.
 *
 * Toạ độ trong builder là toạ độ cục bộ của công trình (gốc ở tâm, +z là mặt tiền).
 * `world` cho biết công trình được đặt ở đâu và xoay bao nhiêu trong scene.
 */
import * as THREE from 'three';
import { rectRing, type CollisionWorld } from './collision';
import type { XZ } from './geo';
import { textTexture } from './textures';

export interface Placement {
  x: number;
  z: number;
  /** Góc xoay quanh trục đứng (radian). */
  rotY: number;
}

interface PartOptions {
  collide?: boolean;
  occlude?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  rotY?: number;
}

export class Builder {
  readonly group = new THREE.Group();
  private cos: number;
  private sin: number;

  constructor(
    readonly world: Placement,
    readonly collisions: CollisionWorld,
    readonly occluders: THREE.Object3D[],
  ) {
    this.group.position.set(world.x, 0, world.z);
    this.group.rotation.y = world.rotY;
    this.cos = Math.cos(world.rotY);
    this.sin = Math.sin(world.rotY);
  }

  /** Đổi toạ độ cục bộ sang toạ độ scene. */
  toWorld([x, z]: XZ): XZ {
    return [this.world.x + x * this.cos + z * this.sin, this.world.z - x * this.sin + z * this.cos];
  }

  /** Đổi hướng cục bộ sang góc trong scene. */
  toWorldAngle(a: number) {
    return a + this.world.rotY;
  }

  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, pos: [number, number, number], opts: PartOptions = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...pos);
    if (opts.rotY) m.rotation.y = opts.rotY;
    m.castShadow = opts.castShadow ?? true;
    m.receiveShadow = opts.receiveShadow ?? true;
    this.group.add(m);
    if (opts.occlude) this.occluders.push(m);
    return m;
  }

  /**
   * Khối hộp đặt trên mặt đất: (x, z) là tâm đáy, y0 là cao độ đáy.
   * Mặc định là vật cản và che camera (tường, cột...).
   */
  box(w: number, h: number, d: number, x: number, y0: number, z: number, material: THREE.Material, opts: PartOptions = {}) {
    const m = this.mesh(worldUV(new THREE.BoxGeometry(w, h, d)), material, [x, y0 + h / 2, z], { occlude: true, ...opts });
    if (opts.collide ?? true) this.collider(x, z, w, d, opts.rotY ?? 0);
    return m;
  }

  /** Vật cản hình chữ nhật (toạ độ cục bộ). */
  collider(x: number, z: number, w: number, d: number, rotY = 0) {
    this.collisions.add(rectRing(x, z, w, d, rotY).map((p) => this.toWorld(p)));
  }

  /** Vật cản đa giác (toạ độ cục bộ). */
  colliderRing(ring: XZ[]) {
    this.collisions.add(ring.map((p) => this.toWorld(p)));
  }

  /** Tường chạy dọc trục x (mặt hướng ±z), có thể khoét các ô cửa đi. */
  wallX(x0: number, x1: number, z: number, h: number, t: number, mat: THREE.Material, openings: { x: number; w: number; h: number }[] = []) {
    const sorted = [...openings].sort((a, b) => a.x - b.x);
    let cur = x0;
    for (const o of sorted) {
      const a = o.x - o.w / 2;
      const b = o.x + o.w / 2;
      if (a > cur) this.box(a - cur, h, t, (cur + a) / 2, 0, z, mat);
      // Phần tường phía trên ô cửa.
      this.box(o.w, h - o.h, t, o.x, o.h, z, mat, { collide: false });
      cur = b;
    }
    if (x1 > cur) this.box(x1 - cur, h, t, (cur + x1) / 2, 0, z, mat);
  }

  /** Tường chạy dọc trục z (mặt hướng ±x). */
  wallZ(z0: number, z1: number, x: number, h: number, t: number, mat: THREE.Material) {
    this.box(t, h, z1 - z0, x, 0, (z0 + z1) / 2, mat);
  }

  /** Biển tên (mặt phẳng có chữ). */
  sign(text: string, pos: [number, number, number], height: number, rotY = 0, opts: Parameters<typeof textTexture>[1] = {}) {
    const { texture, aspect } = textTexture(text, { bg: '#7a1f1a', color: '#ffe7a3', border: '#e8b84a', ...opts });
    const m = this.mesh(
      new THREE.PlaneGeometry(height * aspect, height),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }),
      pos,
      { rotY, castShadow: false },
    );
    return m;
  }
}

/** Mái hai dốc: lăng trụ tam giác chạy dọc trục z. */
export function gableRoofGeometry(width: number, rise: number, length: number) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(0, rise);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  // UV theo mét để texture ngói lặp đều.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getZ(i) / 2, (Math.abs(pos.getX(i)) + pos.getY(i)) / 2);
  return g;
}

/** Tam giác đầu hồi (mặt hướng +z). */
export function gableGeometry(width: number, rise: number) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(0, rise);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/** Ô cửa vòm (nửa tròn phía trên), mặt hướng +z, đáy tại y = 0. */
export function archGeometry(w: number, h: number) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  const g = new THREE.ShapeGeometry(s, 12);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + r) / w, pos.getY(i) / h);
  return g;
}

/** Khung viền cửa vòm: vòm ngoài trừ đi vòm trong (lỗ cửa rộng w, phần chữ nhật cao h). */
export function archFrameGeometry(w: number, h: number, border: number) {
  const arch = (s: THREE.Shape | THREE.Path, ww: number, hh: number, reverse: boolean) => {
    const r = ww / 2;
    if (!reverse) {
      s.moveTo(-r, 0);
      s.lineTo(r, 0);
      s.lineTo(r, hh);
      s.absarc(0, hh, r, 0, Math.PI, false);
      s.lineTo(-r, 0);
    } else {
      s.moveTo(-r, 0);
      s.lineTo(-r, hh);
      s.absarc(0, hh, r, Math.PI, 0, true);
      s.lineTo(r, 0);
      s.lineTo(-r, 0);
    }
  };
  const outer = new THREE.Shape();
  arch(outer, w + border * 2, h, false);
  const hole = new THREE.Path();
  arch(hole, w, h, true);
  outer.holes.push(hole);
  return new THREE.ShapeGeometry(outer, 16);
}

/** Đặt UV theo mét cho hộp, để texture gạch/đá không bị kéo giãn. */
export function worldUV(geo: THREE.BufferGeometry, scale = 0.5) {
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ny > 0.5) uv.setXY(i, x * scale, z * scale);
    else if (nx > 0.5) uv.setXY(i, z * scale, y * scale);
    else uv.setXY(i, x * scale, y * scale);
  }
  uv.needsUpdate = true;
  return geo;
}
