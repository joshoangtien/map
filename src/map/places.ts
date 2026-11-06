import type { LngLatBoundsLike } from 'maplibre-gl';

/** Khung nhìn toàn bộ Việt Nam, gồm cả Hoàng Sa và Trường Sa. */
export const VIETNAM_BOUNDS: LngLatBoundsLike = [
  [101.5, 7.5],
  [117.5, 23.6],
];

/** Vùng được phép kéo bản đồ tới (rộng hơn VN một chút để không bị "cụt"). */
export const MAX_BOUNDS: LngLatBoundsLike = [
  [85, -5],
  [135, 35],
];

export interface QuickPlace {
  name: string;
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
}

/** Các điểm nhảy nhanh trên thanh công cụ. */
export const QUICK_PLACES: QuickPlace[] = [
  { name: 'Hà Nội', center: [105.8504, 21.0287], zoom: 15.6, pitch: 60, bearing: -20 },
  { name: 'Huế', center: [107.5786, 16.4673], zoom: 15, pitch: 55, bearing: 30 },
  { name: 'Đà Nẵng', center: [108.2272, 16.0612], zoom: 15, pitch: 60, bearing: -15 },
  { name: 'Hội An', center: [108.3285, 15.8775], zoom: 16, pitch: 55 },
  { name: 'Đà Lạt', center: [108.4383, 11.9404], zoom: 14.5, pitch: 60, bearing: 40 },
  { name: 'TP. Hồ Chí Minh', center: [106.6990, 10.7798], zoom: 15.6, pitch: 60, bearing: 25 },
  { name: 'Cần Thơ', center: [105.7875, 10.0340], zoom: 15, pitch: 55 },
];
