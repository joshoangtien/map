/**
 * Hệ toạ độ của scene: đơn vị mét, gốc (0,0) tại địa điểm được chọn.
 * Trục x hướng Đông, trục z hướng Nam (quy ước của three.js: phía Bắc là -z).
 */

export type XZ = [number, number];

export interface Projector {
  toLocal(lng: number, lat: number): XZ;
}

export function makeProjector(lng0: number, lat0: number): Projector {
  const mPerLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const mPerLat = 110_574;
  return {
    toLocal: (lng, lat) => [(lng - lng0) * mPerLng, -(lat - lat0) * mPerLat],
  };
}

export interface SiteBuilding {
  ring: XZ[];
  holes: XZ[][];
  height: number;
  minHeight: number;
}

export interface SiteRoad {
  line: XZ[];
  kind: string;
  width: number;
}

export interface SiteArea {
  ring: XZ[];
  holes: XZ[][];
}

/** Dữ liệu thật xung quanh một địa điểm, lấy từ bản đồ. */
export interface SiteData {
  radius: number;
  /** Toà nhà chứa địa điểm (nếu tìm thấy). */
  target: SiteBuilding | null;
  buildings: SiteBuilding[];
  roads: SiteRoad[];
  water: SiteArea[];
  green: SiteArea[];
}

export const EMPTY_SITE: SiteData = { radius: 160, target: null, buildings: [], roads: [], water: [], green: [] };

// ---------- Hình học phẳng ----------

export function pointInRing([x, z]: XZ, ring: XZ[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function closestOnSegment(p: XZ, a: XZ, b: XZ): XZ {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2)) : 0;
  return [a[0] + t * dx, a[1] + t * dz];
}

export const dist = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function distToPolyline(p: XZ, line: XZ[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, dist(p, closestOnSegment(p, line[i - 1], line[i])));
  return best;
}

export function ringCentroid(ring: XZ[]): XZ {
  let x = 0;
  let z = 0;
  for (const p of ring) {
    x += p[0];
    z += p[1];
  }
  return [x / ring.length, z / ring.length];
}

/** Bao lồi (thuật toán monotone chain). */
export function convexHull(points: XZ[]): XZ[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: XZ, a: XZ, b: XZ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: XZ[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: XZ[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Hình chữ nhật bao nhỏ nhất (có xoay) của một mặt bằng. */
export interface OrientedRect {
  center: XZ;
  /** Cạnh dài. */
  length: number;
  /** Cạnh ngắn. */
  width: number;
  /** Vector đơn vị theo cạnh dài. */
  axis: XZ;
}

export function minAreaRect(points: XZ[]): OrientedRect | null {
  const hull = convexHull(points);
  if (hull.length < 3) return null;
  let best: OrientedRect | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p[0] * ux + p[1] * uz;
      const v = -p[0] * uz + p[1] * ux;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea) {
      bestArea = area;
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      const center: XZ = [cu * ux - cv * uz, cu * uz + cv * ux];
      const du = maxU - minU;
      const dv = maxV - minV;
      best = du >= dv ? { center, length: du, width: dv, axis: [ux, uz] } : { center, length: dv, width: du, axis: [-uz, ux] };
    }
  }
  return best;
}
