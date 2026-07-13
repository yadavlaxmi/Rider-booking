import { CircleMarker, MapContainer, Polyline, TileLayer } from "react-leaflet";

function normalizeCenter(points) {
  if (!points.length) return [28.6139, 77.209];
  return points[0];
}

function RouteMap({ title, pickup, drop, driver, polyline = [] }) {
  const points = polyline.length
    ? polyline
    : [pickup, drop]
        .filter(Boolean)
        .map((point) => [Number(point.latitude), Number(point.longitude)]);

  const center = normalizeCenter(points);

  return (
    <div className="map-card">
      <div className="map-card__header">
        <strong>{title}</strong>
        <span>Route preview</span>
      </div>
      <MapContainer center={center} zoom={13} className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pickup ? <CircleMarker center={[Number(pickup.latitude), Number(pickup.longitude)]} radius={10} /> : null}
        {drop ? <CircleMarker center={[Number(drop.latitude), Number(drop.longitude)]} radius={10} /> : null}
        {driver ? <CircleMarker center={[Number(driver.latitude), Number(driver.longitude)]} radius={10} /> : null}
        {points.length >= 2 ? <Polyline positions={points} /> : null}
      </MapContainer>
    </div>
  );
}

export default RouteMap;

