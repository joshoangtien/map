/**
 * Style bản đồ tự viết trên nền vector tile OpenMapTiles của OpenFreeMap.
 *
 * Tự viết thay vì dùng style có sẵn để:
 *  - ưu tiên tên tiếng Việt (`name:vi`),
 *  - ẩn nhãn/ranh giới tranh chấp và thay bằng nhãn chủ quyền Việt Nam,
 *  - dựng nhà 3D, địa hình, và lớp POI bấm được.
 */
import type { ExpressionSpecification, FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { POI_CLASSES, POI_COLOR_EXPR } from './poi';
import { HOANG_SA_AREA, SEA_AREA, SOVEREIGNTY_LABELS, TRUONG_SA_AREA } from './sovereignty';

const OMT = 'openmaptiles';
const FONT_REGULAR = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_ITALIC = ['Noto Sans Italic'];

/** Tên hiển thị: ưu tiên tiếng Việt. */
const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:vi'], ['get', 'name'], ''];

const notWithin = (area: GeoJSON.Polygon): ExpressionSpecification => ['!', ['within', area]];

/** Ẩn mọi nhãn gốc nằm trong khu vực Hoàng Sa / Trường Sa. */
const OUTSIDE_ARCHIPELAGOS: ExpressionSpecification = ['all', notWithin(HOANG_SA_AREA), notWithin(TRUONG_SA_AREA)];

const zoomInterp = (...stops: number[]): ExpressionSpecification =>
  ['interpolate', ['exponential', 1.6], ['zoom'], ...stops] as ExpressionSpecification;

const COLORS = {
  land: '#f3efe6',
  water: '#a9d3ee',
  waterLine: '#8cc4e8',
  wood: '#b9d7a3',
  grass: '#d3e6bd',
  farmland: '#ece9c8',
  park: '#c6e3b0',
  residential: '#ebe4d6',
  motorway: '#f2a65a',
  trunk: '#f7c873',
  primary: '#fde29b',
  road: '#ffffff',
  casing: '#d2c6b4',
  rail: '#a8a29a',
  boundary: '#9b5f8a',
  label: '#3d3a35',
  halo: 'rgba(255,255,255,0.9)',
};

/** `width`: các cặp [zoom, độ rộng px] cho viền đường; lòng đường hẹp hơn một chút. */
type RoadDef = { id: string; classes: string[]; color: string; width: number[]; minzoom: number };

const scaled = (stops: number[], k: number) => zoomInterp(...stops.map((v, i) => (i % 2 ? v * k : v)));

const ROADS: RoadDef[] = [
  { id: 'path', classes: ['path', 'track'], color: '#ffffff', width: [14, 0.6, 18, 3], minzoom: 14 },
  { id: 'service', classes: ['service'], color: COLORS.road, width: [14, 0.8, 18, 7], minzoom: 13 },
  { id: 'minor', classes: ['minor'], color: COLORS.road, width: [12, 0.6, 14, 2.5, 18, 16], minzoom: 12 },
  { id: 'tertiary', classes: ['tertiary'], color: COLORS.road, width: [10, 0.6, 14, 4, 18, 22], minzoom: 10 },
  { id: 'secondary', classes: ['secondary'], color: COLORS.primary, width: [8, 0.6, 14, 5, 18, 26], minzoom: 8 },
  { id: 'primary', classes: ['primary'], color: COLORS.primary, width: [6, 0.6, 14, 6, 18, 30], minzoom: 6 },
  { id: 'trunk', classes: ['trunk'], color: COLORS.trunk, width: [5, 0.6, 14, 7, 18, 32], minzoom: 5 },
  { id: 'motorway', classes: ['motorway'], color: COLORS.motorway, width: [5, 0.8, 14, 8, 18, 34], minzoom: 5 },
];

function roadLayers(): LayerSpecification[] {
  const casings: LayerSpecification[] = [];
  const fills: LayerSpecification[] = [];
  for (const r of ROADS) {
    const filter: FilterSpecification = [
      'all',
      ['match', ['get', 'class'], r.classes, true, false],
      ['!=', ['get', 'brunnel'], 'tunnel'],
    ];
    if (r.id !== 'path') {
      casings.push({
        id: `road-${r.id}-casing`,
        type: 'line',
        source: OMT,
        'source-layer': 'transportation',
        minzoom: Math.max(r.minzoom, 12),
        filter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.casing, 'line-width': scaled(r.width, 1), 'line-gap-width': 0, 'line-opacity': 1 },
      });
    }
    fills.push({
      id: `road-${r.id}`,
      type: 'line',
      source: OMT,
      'source-layer': 'transportation',
      minzoom: r.minzoom,
      filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint:
        r.id === 'path'
          ? { 'line-color': '#c9b9a0', 'line-width': scaled(r.width, 1), 'line-dasharray': [2, 1.5] }
          : { 'line-color': r.color, 'line-width': scaled(r.width, 0.78) },
    });
  }
  return [...casings, ...fills];
}

export function buildStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Bản đồ Việt Nam',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#7fb4e6',
      'horizon-color': '#dfeefa',
      'fog-color': '#eef4f8',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.4,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.6, 9, 0],
    },
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.35, position: [1.2, 210, 35] },
    sources: {
      [OMT]: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Dữ liệu © <a href="https://www.openstreetmap.org/copyright" target="_blank">Những người đóng góp OpenStreetMap</a>',
      },
      'hillshade-dem': {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
        attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank">Terrain Tiles</a>',
      },
      'terrain-dem': {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
      },
      sovereignty: { type: 'geojson', data: SOVEREIGNTY_LABELS },
      'selected-poi': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': COLORS.land } },

      // --- Mặt đất ---
      {
        id: 'landcover',
        type: 'fill',
        source: OMT,
        'source-layer': 'landcover',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'wood', COLORS.wood,
            'grass', COLORS.grass,
            'farmland', COLORS.farmland,
            'wetland', '#cfe3d4',
            'sand', '#f2e6c2',
            'rock', '#e2ddd5',
            'ice', '#ffffff',
            COLORS.grass,
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 12, 0.9],
        },
      },
      {
        id: 'landuse-residential',
        type: 'fill',
        source: OMT,
        'source-layer': 'landuse',
        minzoom: 9,
        filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood'], true, false],
        paint: { 'fill-color': COLORS.residential, 'fill-opacity': 0.7 },
      },
      {
        id: 'landuse-other',
        type: 'fill',
        source: OMT,
        'source-layer': 'landuse',
        minzoom: 11,
        filter: ['match', ['get', 'class'], ['school', 'university', 'college', 'hospital', 'cemetery', 'stadium', 'pitch'], true, false],
        paint: {
          'fill-color': ['match', ['get', 'class'], ['cemetery'], '#d9e3cf', ['hospital'], '#f6dede', ['stadium', 'pitch'], '#cfe8c0', '#efe6cf'],
        },
      },
      {
        id: 'park',
        type: 'fill',
        source: OMT,
        'source-layer': 'park',
        paint: { 'fill-color': COLORS.park, 'fill-opacity': 0.7 },
      },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshade-dem',
        paint: {
          'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 12, 0.25],
          'hillshade-shadow-color': '#5a5040',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#5a5040',
        },
      },

      // --- Nước ---
      {
        id: 'water',
        type: 'fill',
        source: OMT,
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-color': COLORS.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: OMT,
        'source-layer': 'waterway',
        minzoom: 8,
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: {
          'line-color': COLORS.waterLine,
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.5, 18, ['match', ['get', 'class'], 'river', 14, 'canal', 8, 3]],
        },
      },
      {
        id: 'aeroway',
        type: 'fill',
        source: OMT,
        'source-layer': 'aeroway',
        minzoom: 11,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#e4e1ea' },
      },

      // --- Ranh giới (bỏ ranh giới tranh chấp & trên biển) ---
      {
        id: 'boundary-province',
        type: 'line',
        source: OMT,
        'source-layer': 'boundary',
        minzoom: 5,
        filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1], ['!=', ['get', 'disputed'], 1]],
        paint: { 'line-color': COLORS.boundary, 'line-opacity': 0.35, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 1.6], 'line-dasharray': [3, 2] },
      },
      {
        id: 'boundary-country',
        type: 'line',
        source: OMT,
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1], ['!=', ['get', 'disputed'], 1]],
        paint: { 'line-color': COLORS.boundary, 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 10, 2.5] },
      },

      // --- Đường ---
      {
        id: 'railway',
        type: 'line',
        source: OMT,
        'source-layer': 'transportation',
        minzoom: 8,
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel']],
        paint: { 'line-color': COLORS.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 16, 2.5], 'line-dasharray': [3, 2] },
      },
      ...roadLayers(),

      // --- Nhà 3D ---
      {
        id: 'building-3d',
        type: 'fill-extrusion',
        source: OMT,
        'source-layer': 'building',
        minzoom: 13.5,
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'render_height'], 6],
            0, '#efe7da',
            15, '#e6dccb',
            40, '#d6cfc6',
            100, '#c3c8d0',
          ],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, ['coalesce', ['get', 'render_height'], 6]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },

      // --- Nhãn ---
      {
        id: 'water-name',
        type: 'symbol',
        source: OMT,
        'source-layer': 'water_name',
        filter: [
          'all',
          OUTSIDE_ARCHIPELAGOS,
          // Ẩn tên biển/vịnh gốc quanh Việt Nam, dùng nhãn tiếng Việt của ta.
          ['any', ['!', ['match', ['get', 'class'], ['sea', 'ocean', 'bay', 'strait'], true, false]], notWithin(SEA_AREA)],
        ],
        layout: {
          'text-field': NAME,
          'text-font': FONT_ITALIC,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 12, 14],
          'text-max-width': 8,
        },
        paint: { 'text-color': '#3f78a8', 'text-halo-color': 'rgba(255,255,255,0.6)', 'text-halo-width': 1 },
      },
      {
        id: 'road-name',
        type: 'symbol',
        source: OMT,
        'source-layer': 'transportation_name',
        minzoom: 13,
        layout: {
          'symbol-placement': 'line',
          'text-field': NAME,
          'text-font': FONT_REGULAR,
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 18, 14],
          'text-max-angle': 30,
        },
        paint: { 'text-color': '#56514a', 'text-halo-color': COLORS.halo, 'text-halo-width': 1.4 },
      },
      {
        id: 'poi-dot',
        type: 'circle',
        source: OMT,
        'source-layer': 'poi',
        minzoom: 14,
        filter: ['all', ['match', ['get', 'class'], POI_CLASSES, true, false], ['has', 'name'], OUTSIDE_ARCHIPELAGOS],
        paint: {
          'circle-color': POI_COLOR_EXPR,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 3.5, 18, 7],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-pitch-alignment': 'viewport',
        },
      },
      {
        id: 'poi-label',
        type: 'symbol',
        source: OMT,
        'source-layer': 'poi',
        minzoom: 15,
        filter: ['all', ['match', ['get', 'class'], POI_CLASSES, true, false], ['has', 'name'], OUTSIDE_ARCHIPELAGOS],
        layout: {
          'text-field': NAME,
          'text-font': FONT_REGULAR,
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 0.7],
          'text-max-width': 9,
          'symbol-sort-key': ['get', 'rank'],
        },
        paint: { 'text-color': POI_COLOR_EXPR, 'text-halo-color': COLORS.halo, 'text-halo-width': 1.5 },
      },
      {
        id: 'place-minor',
        type: 'symbol',
        source: OMT,
        'source-layer': 'place',
        minzoom: 10,
        filter: ['all', ['match', ['get', 'class'], ['village', 'suburb', 'quarter', 'neighbourhood', 'hamlet', 'island', 'islet'], true, false], OUTSIDE_ARCHIPELAGOS],
        layout: {
          'text-field': NAME,
          'text-font': FONT_REGULAR,
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 16, 15],
          'text-max-width': 8,
        },
        paint: { 'text-color': '#5b554c', 'text-halo-color': COLORS.halo, 'text-halo-width': 1.4 },
      },
      {
        id: 'place-town',
        type: 'symbol',
        source: OMT,
        'source-layer': 'place',
        minzoom: 7,
        filter: ['all', ['==', ['get', 'class'], 'town'], OUTSIDE_ARCHIPELAGOS],
        layout: { 'text-field': NAME, 'text-font': FONT_REGULAR, 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 14, 17], 'text-max-width': 8 },
        paint: { 'text-color': COLORS.label, 'text-halo-color': COLORS.halo, 'text-halo-width': 1.5 },
      },
      {
        id: 'place-city',
        type: 'symbol',
        source: OMT,
        'source-layer': 'place',
        minzoom: 4,
        maxzoom: 15,
        filter: ['all', ['==', ['get', 'class'], 'city'], OUTSIDE_ARCHIPELAGOS],
        layout: {
          'text-field': NAME,
          'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, ['step', ['coalesce', ['get', 'rank'], 10], 13, 4, 11], 12, 22],
          'text-max-width': 8,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 10],
        },
        paint: { 'text-color': '#2b2824', 'text-halo-color': COLORS.halo, 'text-halo-width': 1.8 },
      },
      {
        id: 'place-country',
        type: 'symbol',
        source: OMT,
        'source-layer': 'place',
        maxzoom: 8,
        filter: ['==', ['get', 'class'], 'country'],
        layout: {
          'text-field': NAME,
          'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 6, 18],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
          'text-max-width': 6,
        },
        paint: { 'text-color': '#6b4a63', 'text-halo-color': COLORS.halo, 'text-halo-width': 2 },
      },

      // --- Nhãn chủ quyền ---
      {
        id: 'sovereignty-sea',
        type: 'symbol',
        source: 'sovereignty',
        filter: ['match', ['get', 'kind'], ['sea', 'gulf'], true, false],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT_ITALIC,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'kind'], 'sea', 15, 11], 8, ['match', ['get', 'kind'], 'sea', 26, 17]],
          'text-letter-spacing': ['match', ['get', 'kind'], 'sea', 0.3, 0.1],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#2f6b9a', 'text-halo-color': 'rgba(255,255,255,0.5)', 'text-halo-width': 1 },
      },
      {
        id: 'sovereignty-archipelago',
        type: 'symbol',
        source: 'sovereignty',
        minzoom: 3.5,
        filter: ['==', ['get', 'kind'], 'archipelago'],
        layout: {
          'text-field': ['format', ['get', 'name'], {}, '\n', {}, ['get', 'sub'], { 'font-scale': 0.85 }],
          'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3.5, 11, 8, 17],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#7a2a2a', 'text-halo-color': COLORS.halo, 'text-halo-width': 1.8 },
      },
      {
        id: 'sovereignty-island',
        type: 'symbol',
        source: 'sovereignty',
        minzoom: 7,
        filter: ['==', ['get', 'kind'], 'island'],
        layout: { 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 0.4] },
        paint: { 'text-color': '#5b3a3a', 'text-halo-color': COLORS.halo, 'text-halo-width': 1.5 },
      },

      // --- Địa điểm đang chọn ---
      {
        id: 'selected-poi-halo',
        type: 'circle',
        source: 'selected-poi',
        paint: {
          'circle-radius': 16,
          'circle-color': 'rgba(218,37,29,0.18)',
          'circle-stroke-color': '#da251d',
          'circle-stroke-width': 2.5,
          'circle-pitch-alignment': 'viewport',
        },
      },
    ],
  };
}

/** Các layer có thể bấm vào để chọn địa điểm. */
export const CLICKABLE_LAYERS = ['poi-dot', 'poi-label'];
