/**
 * Phân loại địa điểm (POI) từ lớp `poi` của OpenMapTiles sang nhóm tiếng Việt.
 * Mỗi nhóm có màu riêng trên bản đồ và tên hiển thị trong bảng thông tin.
 */
import type { ExpressionSpecification } from 'maplibre-gl';

export interface PoiGroup {
  id: string;
  label: string;
  color: string;
  /** Giá trị `class` trong OpenMapTiles thuộc nhóm này. */
  classes: string[];
}

export const POI_GROUPS: PoiGroup[] = [
  { id: 'worship', label: 'Nơi thờ tự', color: '#b0413e', classes: ['place_of_worship'] },
  { id: 'culture', label: 'Văn hoá – di tích', color: '#8e44ad', classes: ['museum', 'attraction', 'monument', 'castle', 'art_gallery', 'theatre', 'cinema', 'library', 'historic'] },
  { id: 'education', label: 'Giáo dục', color: '#2f6fb3', classes: ['school', 'college', 'kindergarten', 'university'] },
  { id: 'health', label: 'Y tế', color: '#d64550', classes: ['hospital', 'doctors', 'pharmacy', 'dentist', 'clinic'] },
  { id: 'food', label: 'Ăn uống', color: '#e67e22', classes: ['cafe', 'restaurant', 'fast_food', 'bar', 'pub', 'beer', 'ice_cream', 'bakery'] },
  { id: 'shop', label: 'Mua sắm', color: '#c0392b', classes: ['shop', 'grocery', 'clothing_store', 'department_store', 'mall', 'marketplace'] },
  { id: 'leisure', label: 'Giải trí – thể thao', color: '#27ae60', classes: ['park', 'stadium', 'pitch', 'sports', 'playground', 'swimming_pool', 'garden', 'zoo', 'golf'] },
  { id: 'civic', label: 'Hành chính – dịch vụ', color: '#5d6d7e', classes: ['town_hall', 'police', 'post', 'bank', 'fire_station', 'prison', 'embassy'] },
  { id: 'lodging', label: 'Lưu trú', color: '#16a085', classes: ['lodging', 'campsite'] },
  { id: 'transport', label: 'Giao thông', color: '#34495e', classes: ['railway', 'bus', 'ferry_terminal', 'airport', 'aerialway', 'fuel'] },
];

export const POI_CLASSES = POI_GROUPS.flatMap((g) => g.classes);

/** Biểu thức màu chấm POI theo `class`. */
export const POI_COLOR_EXPR: ExpressionSpecification = [
  'match',
  ['get', 'class'],
  ...POI_GROUPS.flatMap((g) => [g.classes, g.color] as [string[], string]),
  '#7f8c8d',
] as unknown as ExpressionSpecification;

const CLASS_LABEL: Record<string, string> = {
  school: 'Trường học',
  college: 'Trường cao đẳng / đại học',
  university: 'Trường đại học',
  kindergarten: 'Trường mầm non',
  hospital: 'Bệnh viện',
  doctors: 'Phòng khám',
  clinic: 'Phòng khám',
  dentist: 'Nha khoa',
  pharmacy: 'Nhà thuốc',
  museum: 'Bảo tàng',
  attraction: 'Điểm tham quan',
  monument: 'Tượng đài',
  castle: 'Thành cổ',
  art_gallery: 'Phòng tranh',
  theatre: 'Nhà hát',
  cinema: 'Rạp chiếu phim',
  library: 'Thư viện',
  cafe: 'Quán cà phê',
  restaurant: 'Nhà hàng',
  fast_food: 'Đồ ăn nhanh',
  bar: 'Quán bar',
  pub: 'Quán nhậu',
  beer: 'Quán bia',
  bakery: 'Tiệm bánh',
  ice_cream: 'Kem',
  shop: 'Cửa hàng',
  grocery: 'Tạp hoá',
  mall: 'Trung tâm thương mại',
  department_store: 'Trung tâm thương mại',
  marketplace: 'Chợ',
  park: 'Công viên',
  stadium: 'Sân vận động',
  pitch: 'Sân thể thao',
  sports: 'Thể thao',
  playground: 'Sân chơi',
  swimming_pool: 'Bể bơi',
  garden: 'Vườn',
  zoo: 'Vườn thú',
  golf: 'Sân golf',
  town_hall: 'Trụ sở hành chính',
  police: 'Công an',
  post: 'Bưu điện',
  bank: 'Ngân hàng',
  fire_station: 'Phòng cháy chữa cháy',
  embassy: 'Đại sứ quán',
  lodging: 'Khách sạn / nhà nghỉ',
  campsite: 'Khu cắm trại',
  railway: 'Ga tàu',
  bus: 'Trạm xe buýt',
  ferry_terminal: 'Bến phà',
  airport: 'Sân bay',
  fuel: 'Cây xăng',
};

/**
 * OpenMapTiles không có trường tôn giáo cho `place_of_worship`,
 * nên đoán loại công trình từ tên tiếng Việt.
 */
function worshipKind(name: string): string {
  const n = name.toLowerCase();
  if (/(^|\s)(nhà thờ|giáo xứ|giáo họ|thánh đường|nhà nguyện|church|cathedral)/.test(n)) return 'Nhà thờ';
  if (/(^|\s)(chùa|thiền viện|tịnh xá|tu viện|pagoda)/.test(n)) return 'Chùa';
  if (/(^|\s)(đình)/.test(n)) return 'Đình';
  if (/(^|\s)(đền|temple)/.test(n)) return 'Đền';
  if (/(^|\s)(miếu|phủ|điện)/.test(n)) return 'Miếu / Phủ';
  if (/(^|\s)(thánh thất|cao đài)/.test(n)) return 'Thánh thất Cao Đài';
  if (/(^|\s)(masjid|mosque|thánh đường hồi giáo)/.test(n)) return 'Thánh đường Hồi giáo';
  return 'Nơi thờ tự';
}

export function describePoi(cls: string, subclass: string | undefined, name: string): { kind: string; group: PoiGroup | undefined } {
  const group = POI_GROUPS.find((g) => g.classes.includes(cls));
  let kind: string;
  if (cls === 'place_of_worship') kind = worshipKind(name);
  else kind = CLASS_LABEL[subclass ?? ''] ?? CLASS_LABEL[cls] ?? group?.label ?? 'Địa điểm';
  return { kind, group };
}
