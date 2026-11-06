/**
 * Va chạm 2D đơn giản trên mặt phẳng XZ: nhân vật là một hình tròn,
 * vật cản là các đa giác (tường, nhà, mặt nước...). Đủ cho đi bộ trên mặt phẳng.
 */
import { closestOnSegment, pointInRing, type XZ } from './geo';

export interface Collider {
  ring: XZ[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function makeCollider(ring: XZ[]): Collider {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { ring, minX, maxX, minZ, maxZ };
}

/** Hình chữ nhật tâm (cx, cz), kích thước w×d, xoay quanh trục đứng một góc rotY. */
export function rectRing(cx: number, cz: number, w: number, d: number, rotY = 0): XZ[] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return ([
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ] as XZ[]).map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
}

export class CollisionWorld {
  colliders: Collider[] = [];

  add(ring: XZ[]) {
    if (ring.length >= 3) this.colliders.push(makeCollider(ring));
  }

  /** Đẩy hình tròn (p, r) ra khỏi mọi vật cản. Trả về vị trí mới. */
  resolve(p: XZ, r: number): XZ {
    let [x, z] = p;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const c of this.colliders) {
        if (x < c.minX - r || x > c.maxX + r || z < c.minZ - r || z > c.maxZ + r) continue;
        const q: XZ = [x, z];
        let best: XZ = q;
        let bestD = Infinity;
        for (let i = 0, j = c.ring.length - 1; i < c.ring.length; j = i++) {
          const cp = closestOnSegment(q, c.ring[j], c.ring[i]);
          const d = Math.hypot(cp[0] - x, cp[1] - z);
          if (d < bestD) {
            bestD = d;
            best = cp;
          }
        }
        const inside = pointInRing(q, c.ring);
        if (inside) {
          // Ở trong vật cản: đẩy ra qua cạnh gần nhất.
          const dx = best[0] - x;
          const dz = best[1] - z;
          const l = Math.hypot(dx, dz) || 1;
          x = best[0] + (dx / l) * r;
          z = best[1] + (dz / l) * r;
          moved = true;
        } else if (bestD < r) {
          const dx = x - best[0];
          const dz = z - best[1];
          const l = bestD || 1;
          x = best[0] + (dx / l) * r;
          z = best[1] + (dz / l) * r;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return [x, z];
  }

  /** Điểm có nằm trong vật cản nào không (dùng khi rải cây, chọn điểm xuất hiện). */
  blocked(p: XZ, margin = 0): boolean {
    for (const c of this.colliders) {
      if (p[0] < c.minX - margin || p[0] > c.maxX + margin || p[1] < c.minZ - margin || p[1] > c.maxZ + margin) continue;
      if (pointInRing(p, c.ring)) return true;
      if (margin > 0) {
        for (let i = 0, j = c.ring.length - 1; i < c.ring.length; j = i++) {
          const cp = closestOnSegment(p, c.ring[j], c.ring[i]);
          if (Math.hypot(cp[0] - p[0], cp[1] - p[1]) < margin) return true;
        }
      }
    }
    return false;
  }
}
