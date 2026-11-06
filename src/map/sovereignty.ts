/**
 * Lớp nhãn chủ quyền Việt Nam.
 *
 * Dữ liệu OSM/OpenMapTiles có thể ghi tên quần đảo, đảo và biển theo các ngôn ngữ
 * hoặc cách gọi khác. Ta ẩn các nhãn gốc trong những vùng dưới đây và vẽ nhãn của
 * mình thay vào: "Quần đảo Hoàng Sa", "Quần đảo Trường Sa", "Biển Đông"...
 */
import type { FeatureCollection, Point, Polygon } from 'geojson';

const box = (w: number, s: number, e: number, n: number): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ],
  ],
});

/** Khu vực quần đảo Hoàng Sa: ẩn mọi nhãn đảo/POI gốc trong này. */
export const HOANG_SA_AREA = box(110.9, 15.6, 113.2, 17.3);
/** Khu vực quần đảo Trường Sa: ẩn mọi nhãn đảo/POI gốc trong này. */
export const TRUONG_SA_AREA = box(111.0, 7.2, 117.0, 12.2);
/** Vùng biển: ẩn nhãn tên biển/vịnh gốc trong này, thay bằng nhãn tiếng Việt. */
export const SEA_AREA = box(99.0, 3.0, 121.5, 23.0);

type LabelKind = 'archipelago' | 'island' | 'sea' | 'gulf';

interface LabelProps {
  name: string;
  sub?: string;
  kind: LabelKind;
}

const pt = (lng: number, lat: number, props: LabelProps) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point', coordinates: [lng, lat] } as Point,
  properties: props,
});

export const SOVEREIGNTY_LABELS: FeatureCollection<Point, LabelProps> = {
  type: 'FeatureCollection',
  features: [
    pt(113.6, 14.3, { name: 'Biển Đông', kind: 'sea' }),
    pt(107.4, 20.0, { name: 'Vịnh Bắc Bộ', kind: 'gulf' }),
    pt(102.6, 9.6, { name: 'Vịnh Thái Lan', kind: 'gulf' }),

    pt(112.0, 16.95, { name: 'Quần đảo Hoàng Sa', sub: '(Việt Nam)', kind: 'archipelago' }),
    pt(114.4, 10.4, { name: 'Quần đảo Trường Sa', sub: '(Việt Nam)', kind: 'archipelago' }),

    // Một số đảo tiêu biểu (toạ độ gần đúng).
    pt(112.339, 16.834, { name: 'Đảo Phú Lâm', kind: 'island' }),
    pt(111.611, 16.533, { name: 'Đảo Hoàng Sa', kind: 'island' }),
    pt(111.744, 16.45, { name: 'Đảo Quang Hòa', kind: 'island' }),
    pt(111.92, 8.645, { name: 'Đảo Trường Sa Lớn', kind: 'island' }),
    pt(114.333, 11.43, { name: 'Đảo Song Tử Tây', kind: 'island' }),
    pt(114.334, 9.883, { name: 'Đảo Sinh Tồn', kind: 'island' }),
    pt(114.362, 10.377, { name: 'Đảo Ba Bình', kind: 'island' }),
    pt(112.917, 7.867, { name: 'Đảo An Bang', kind: 'island' }),
  ],
};
