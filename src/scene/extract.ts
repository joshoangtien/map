/**
 * Lấy dữ liệu thật quanh một địa điểm từ các tile bản đồ đã tải
 * (nhà, đường, nước, cây xanh) để dựng môi trường xung quanh trong scene.
 */
import type { Map as MapLibreMap, GeoJSONFeature } from 'maplibre-gl';
import type { Polygon, MultiPolygon, LineString, MultiLineString, Position } from 'geojson';
import { dist, makeProjector, pointInRing, ringCentroid, type Projector, type SiteArea, type SiteBuilding, type SiteData, type SiteRoad, type XZ } from './geo';

const SOURCE = 'openmaptiles';
const RADIUS = 160;

const ROAD_WIDTH: Record<string, number> = {
  motorway: 16,
  trunk: 14,
  primary: 12,
  secondary: 10,
  tertiary: 8,
  minor: 6,
  service: 4,
  track: 3,
  path: 2,
  pedestrian: 5,
};

function polygons(f: GeoJSONFeature): Position[][][] {
  const g = f.geometry as Polygon | MultiPolygon;
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

function lines(f: GeoJSONFeature): Position[][] {
  const g = f.geometry as LineString | MultiLineString;
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  return [];
}

const project = (proj: Projector, ring: Position[]): XZ[] => {
  const out = ring.map(([lng, lat]) => proj.toLocal(lng, lat));
  // Bỏ điểm cuối trùng điểm đầu.
  if (out.length > 1 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  return out;
};

const near = (ring: XZ[], r: number) => ring.some((p) => Math.hypot(p[0], p[1]) < r);

/** Khoá để loại bản trùng (một đối tượng có thể nằm ở nhiều tile). */
const keyOf = (ring: XZ[]) => `${ring.length}:${ring[0][0].toFixed(1)},${ring[0][1].toFixed(1)}:${ringCentroid(ring).map((v) => v.toFixed(1)).join(',')}`;

function areas(map: MapLibreMap, proj: Projector, sourceLayer: string, filter?: (f: GeoJSONFeature) => boolean): SiteArea[] {
  const out: SiteArea[] = [];
  const seen = new Set<string>();
  for (const f of map.querySourceFeatures(SOURCE, { sourceLayer })) {
    if (filter && !filter(f)) continue;
    for (const poly of polygons(f)) {
      const ring = project(proj, poly[0]);
      if (ring.length < 3 || !near(ring, RADIUS * 1.5)) continue;
      const k = keyOf(ring);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ring, holes: poly.slice(1).map((h) => project(proj, h)).filter((h) => h.length >= 3) });
    }
  }
  return out;
}

export function extractSite(map: MapLibreMap, lngLat: [number, number]): SiteData {
  const proj = makeProjector(lngLat[0], lngLat[1]);

  // --- Nhà ---
  const buildings: SiteBuilding[] = [];
  const seen = new Set<string>();
  for (const f of map.querySourceFeatures(SOURCE, { sourceLayer: 'building' })) {
    const p = f.properties as Record<string, unknown>;
    if (p.hide_3d === true) continue;
    for (const poly of polygons(f)) {
      const ring = project(proj, poly[0]);
      if (ring.length < 3 || !near(ring, RADIUS)) continue;
      const k = keyOf(ring);
      if (seen.has(k)) continue;
      seen.add(k);
      buildings.push({
        ring,
        holes: poly.slice(1).map((h) => project(proj, h)).filter((h) => h.length >= 3),
        height: Math.max(3, Number(p.render_height ?? 6)),
        minHeight: Number(p.render_min_height ?? 0),
      });
    }
  }

  // Toà nhà chứa địa điểm: nhà bao quanh điểm gốc, hoặc nhà gần nhất trong 25 m.
  let target: SiteBuilding | null = buildings.find((b) => pointInRing([0, 0], b.ring)) ?? null;
  if (!target) {
    let best = 25;
    for (const b of buildings) {
      const d = Math.hypot(...ringCentroid(b.ring));
      if (d < best) {
        best = d;
        target = b;
      }
    }
  }

  // --- Đường ---
  const roads: SiteRoad[] = [];
  const seenRoad = new Set<string>();
  for (const f of map.querySourceFeatures(SOURCE, { sourceLayer: 'transportation' })) {
    const p = f.properties as Record<string, unknown>;
    const kind = String(p.class ?? '');
    if (!(kind in ROAD_WIDTH) || p.brunnel === 'tunnel') continue;
    for (const l of lines(f)) {
      const line = l.map(([lng, lat]) => proj.toLocal(lng, lat));
      if (line.length < 2 || !near(line, RADIUS * 1.5)) continue;
      const k = `${kind}:${keyOf(line)}`;
      if (seenRoad.has(k)) continue;
      seenRoad.add(k);
      roads.push({ line, kind, width: ROAD_WIDTH[kind] });
    }
  }

  const water = areas(map, proj, 'water', (f) => (f.properties as Record<string, unknown>).brunnel !== 'tunnel');
  const green = [
    ...areas(map, proj, 'park'),
    ...areas(map, proj, 'landcover', (f) => ['wood', 'grass'].includes(String((f.properties as Record<string, unknown>).class))),
  ];

  return { radius: RADIUS, target, buildings, roads, water, green };
}
