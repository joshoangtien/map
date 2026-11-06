/**
 * Chọn vị trí, kích thước và hướng mặt tiền cho công trình mẫu
 * dựa trên mặt bằng toà nhà thật và con đường gần nhất.
 */
import { distToPolyline, minAreaRect, type SiteData, type XZ } from './geo';
import type { Placement } from './builder';

export interface Fit extends Placement {
  /** Chiều sâu: từ mặt tiền ra phía sau. */
  length: number;
  /** Chiều ngang mặt tiền. */
  width: number;
  /** true nếu kích thước lấy từ toà nhà thật, false nếu dùng mặc định. */
  fromData: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function fitTemplate(
  site: SiteData,
  def: { length: number; width: number },
  lim: { minL: number; maxL: number; minW: number; maxW: number },
  /** true: mặt tiền nằm ở cạnh dài (chùa, đình Việt); false: ở đầu hồi (nhà thờ). */
  facadeOnLongSide = false,
): Fit {
  const rect = site.target ? minAreaRect(site.target.ring) : null;
  const usable = rect && rect.length > 4 && rect.width > 3;
  const center: XZ = usable ? rect.center : [0, 0];
  let axis: XZ = usable ? (facadeOnLongSide ? [-rect.axis[1], rect.axis[0]] : rect.axis) : [0, 1];
  const depth = usable ? (facadeOnLongSide ? rect.width : rect.length) : def.length;
  const across = usable ? (facadeOnLongSide ? rect.length : rect.width) : def.width;
  const length = clamp(depth, lim.minL, lim.maxL);
  const width = clamp(across, lim.minW, facadeOnLongSide ? lim.maxW : Math.min(lim.maxW, length));

  // Mặt tiền quay về phía con đường gần hơn trong hai đầu hồi.
  const end = (s: number): XZ => [center[0] + axis[0] * s * (length / 2), center[1] + axis[1] * s * (length / 2)];
  const roadDist = (p: XZ) => site.roads.reduce((m, r) => Math.min(m, distToPolyline(p, r.line)), Infinity);
  if (site.roads.length) {
    if (roadDist(end(-1)) < roadDist(end(1))) axis = [-axis[0], -axis[1]];
  } else if (axis[1] < 0) {
    // Không có dữ liệu đường: mặc định quay mặt về hướng Nam.
    axis = [-axis[0], -axis[1]];
  }

  // Trục +z cục bộ quay một góc rotY sẽ trùng với hướng mặt tiền.
  return { x: center[0], z: center[1], rotY: Math.atan2(axis[0], axis[1]), length, width, fromData: !!usable };
}
