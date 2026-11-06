import type { SelectedPoi } from './MapView';

interface Props {
  poi: SelectedPoi;
  onClose: () => void;
  onEnter: () => void;
}

export function PoiPanel({ poi, onClose, onEnter }: Props) {
  const [lng, lat] = poi.lngLat;
  return (
    <aside className="poi-panel" role="dialog" aria-label={poi.name}>
      <button className="poi-close" onClick={onClose} aria-label="Đóng">
        ×
      </button>
      <span className="poi-kind" style={{ background: poi.color }}>
        {poi.kind}
      </span>
      <h2>{poi.name}</h2>
      {poi.groupLabel && <p className="poi-group">{poi.groupLabel}</p>}
      <p className="poi-coord">
        {lat.toFixed(5)}° B, {lng.toFixed(5)}° Đ
      </p>
      <button className="poi-enter" onClick={onEnter}>
        Vào địa điểm
        <small>→</small>
      </button>
    </aside>
  );
}
