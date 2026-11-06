import { useCallback, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MapView, type SelectedPoi } from './components/MapView';
import { PoiPanel } from './components/PoiPanel';
import { QUICK_PLACES, VIETNAM_BOUNDS, type QuickPlace } from './map/places';
import { POI_GROUPS } from './map/poi';

const POI_MIN_ZOOM = 14;

export default function App() {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [poi, setPoi] = useState<SelectedPoi | null>(null);
  const [zoom, setZoom] = useState(1.6);
  const [terrain, setTerrain] = useState(false);
  const [globe, setGlobe] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flyTo = useCallback(
    (p: QuickPlace) => {
      map?.flyTo({ center: p.center, zoom: p.zoom, pitch: p.pitch ?? 50, bearing: p.bearing ?? 0, duration: 3000, essential: true });
    },
    [map],
  );

  const resetView = () => map?.fitBounds(VIETNAM_BOUNDS, { padding: 40, pitch: 0, bearing: 0, duration: 2000 });

  const toggleTerrain = () => {
    if (!map) return;
    const next = !terrain;
    map.setTerrain(next ? { source: 'terrain-dem', exaggeration: 1.4 } : null);
    if (next && map.getPitch() < 45) map.easeTo({ pitch: 60, duration: 800 });
    setTerrain(next);
  };

  const toggleGlobe = () => {
    if (!map) return;
    const next = !globe;
    map.setProjection({ type: next ? 'globe' : 'mercator' });
    setGlobe(next);
  };

  return (
    <div className="app">
      <MapView selected={poi} onReady={setMap} onSelect={setPoi} onZoom={setZoom} onError={setError} />

      <header className="topbar">
        <div className="brand">
          <span className="flag" aria-hidden>
            ★
          </span>
          Bản đồ Việt Nam
        </div>
        <nav className="quick">
          {QUICK_PLACES.map((p) => (
            <button key={p.name} onClick={() => flyTo(p)} disabled={!map}>
              {p.name}
            </button>
          ))}
        </nav>
      </header>

      <div className="tools">
        <button onClick={resetView} disabled={!map} title="Xem toàn bộ Việt Nam">
          Toàn quốc
        </button>
        <button onClick={toggleTerrain} disabled={!map} className={terrain ? 'on' : ''} title="Bật/tắt địa hình 3D">
          Địa hình 3D
        </button>
        <button onClick={toggleGlobe} disabled={!map} className={globe ? 'on' : ''} title="Quả địa cầu / bản đồ phẳng">
          Địa cầu
        </button>
        <button onClick={() => setShowLegend((v) => !v)} className={showLegend ? 'on' : ''}>
          Chú giải
        </button>
      </div>

      {showLegend && (
        <ul className="legend">
          {POI_GROUPS.map((g) => (
            <li key={g.id}>
              <i style={{ background: g.color }} />
              {g.label}
            </li>
          ))}
        </ul>
      )}

      {zoom < POI_MIN_ZOOM && !poi && (
        <div className="hint">
          Phóng to vào một khu phố để thấy nhà 3D và các địa điểm có thể bấm vào.
          <br />
          <small>Chuột phải + kéo (hoặc Ctrl + kéo) để xoay và nghiêng bản đồ.</small>
        </div>
      )}

      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Đóng">
            ×
          </button>
        </div>
      )}

      {poi && <PoiPanel poi={poi} onClose={() => setPoi(null)} />}
    </div>
  );
}
