import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function MapPicker({ title, latitude, longitude, onSelect }) {
  const hasPoint = latitude !== "" && longitude !== "";
  const center = hasPoint ? [Number(latitude), Number(longitude)] : [28.6139, 77.209];

  return (
    <div className="map-card">
      <div className="map-card__header">
        <strong>{title}</strong>
        <span>Click map to select coordinates</span>
      </div>
      <MapContainer center={center} zoom={hasPoint ? 14 : 11} className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onSelect={onSelect} />
        {hasPoint ? <CircleMarker center={[Number(latitude), Number(longitude)]} radius={10} /> : null}
      </MapContainer>
    </div>
  );
}

export default MapPicker;

