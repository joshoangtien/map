import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, NavigationControl, ScaleControl, AttributionControl, type MapGeoJSONFeature, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../map/worker';
import { buildStyle, CLICKABLE_LAYERS } from '../map/style';
import { MAX_BOUNDS, VIETNAM_BOUNDS } from '../map/places';
import { describePoi } from '../map/poi';

export interface SelectedPoi {
  id: string;
  name: string;
  kind: string;
  groupLabel?: string;
  color: string;
  lngLat: [number, number];
}

interface Props {
  selected: SelectedPoi | null;
  onReady: (map: MapLibreMap) => void;
  onSelect: (poi: SelectedPoi | null) => void;
  onZoom: (zoom: number) => void;
  onError: (message: string) => void;
}

function toSelected(f: MapGeoJSONFeature): SelectedPoi | null {
  if (f.geometry.type !== 'Point') return null;
  const p = f.properties as Record<string, string | undefined>;
  const name = p['name:vi'] ?? p.name ?? 'Không tên';
  const { kind, group } = describePoi(p.class ?? '', p.subclass, name);
  const [lng, lat] = f.geometry.coordinates as [number, number];
  return {
    id: String(f.id ?? `${p.class}-${lng.toFixed(6)}-${lat.toFixed(6)}`),
    name,
    kind,
    groupLabel: group?.label,
    color: group?.color ?? '#7f8c8d',
    lngLat: [lng, lat],
  };
}

export function MapView({ selected, onReady, onSelect, onZoom, onError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Giữ callback mới nhất mà không phải tạo lại map.
  const cb = useRef({ onReady, onSelect, onZoom, onError });
  cb.current = { onReady, onSelect, onZoom, onError };

  useEffect(() => {
    if (!container.current) return;

    const map = new MapLibreMap({
      container: container.current,
      style: buildStyle(),
      center: [108.5, 15.5],
      zoom: 1.6,
      pitch: 0,
      maxBounds: MAX_BOUNDS,
      maxPitch: 80,
      attributionControl: false,
    });
    mapRef.current = map;
    // Tiện debug trong console khi chạy `npm run dev`.
    if (import.meta.env.DEV) (window as unknown as { __map: MapLibreMap }).__map = map;

    map.addControl(new NavigationControl({ visualizePitch: true, showCompass: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

    // 'style.load' thay vì 'load': không phải chờ mọi tile tải xong mới cho dùng app.
    map.once('style.load', () => {
      // Hiệu ứng mở màn: từ quả địa cầu bay vào Việt Nam.
      map.fitBounds(VIETNAM_BOUNDS, { padding: 40, duration: 3500, essential: true });
      cb.current.onReady(map);
    });

    map.on('error', (e) => {
      const src = (e as { sourceId?: string }).sourceId;
      if (src === 'openmaptiles') cb.current.onError('Không tải được dữ liệu bản đồ. Kiểm tra kết nối mạng rồi tải lại trang.');
      else if (!src) console.error(e.error);
    });

    map.on('zoom', () => cb.current.onZoom(map.getZoom()));

    map.on('click', (e) => {
      const layers = CLICKABLE_LAYERS.filter((id) => map.getLayer(id));
      // Bấm hơi lệch vẫn chọn được (vùng chạm 8px).
      const pad = 8;
      const features = map.queryRenderedFeatures(
        [
          [e.point.x - pad, e.point.y - pad],
          [e.point.x + pad, e.point.y + pad],
        ],
        { layers },
      );
      const poi = features.length ? toSelected(features[0]) : null;
      cb.current.onSelect(poi);
      if (poi) map.easeTo({ center: poi.lngLat, zoom: Math.max(map.getZoom(), 17), pitch: Math.max(map.getPitch(), 55), duration: 900 });
    });

    for (const id of CLICKABLE_LAYERS) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Vẽ vòng tròn đánh dấu địa điểm đang chọn.
  useEffect(() => {
    const src = mapRef.current?.getSource<GeoJSONSource>('selected-poi');
    src?.setData({
      type: 'FeatureCollection',
      features: selected ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: selected.lngLat }, properties: {} }] : [],
    });
  }, [selected]);

  return <div ref={container} className="map" />;
}
