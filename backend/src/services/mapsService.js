const { calculateDistanceKm } = require("./geoService");

function toCoordinate(point) {
  return {
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  };
}

function buildFallbackRoute(origin, destination) {
  const distanceKm = calculateDistanceKm(origin, destination);
  const routeDistanceKm = Number((distanceKm * 1.25).toFixed(2));
  const estimatedMinutes = Math.max(3, Math.round((routeDistanceKm / 25) * 60));

  return {
    provider: "fallback",
    distanceKm: routeDistanceKm,
    estimatedMinutes,
    polyline: [
      [origin.latitude, origin.longitude],
      [destination.latitude, destination.longitude],
    ],
    steps: [
      { instruction: "Head to pickup", latitude: origin.latitude, longitude: origin.longitude },
      { instruction: "Ride to destination", latitude: destination.latitude, longitude: destination.longitude },
    ],
  };
}

async function fetchGoogleRoute(origin, destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("mode", "driving");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Maps request failed with ${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  const leg = route?.legs?.[0];
  if (!route || !leg) {
    return null;
  }

  return {
    provider: "google",
    distanceKm: Number((leg.distance.value / 1000).toFixed(2)),
    estimatedMinutes: Math.max(1, Math.round(leg.duration.value / 60)),
    polyline: [
      [origin.latitude, origin.longitude],
      [destination.latitude, destination.longitude],
    ],
    steps: (leg.steps || []).map((step) => ({
      instruction: String(step.html_instructions || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      latitude: step.end_location?.lat,
      longitude: step.end_location?.lng,
    })),
  };
}

async function getRouteDetails({ origin, destination }) {
  const safeOrigin = toCoordinate(origin);
  const safeDestination = toCoordinate(destination);

  try {
    const googleRoute = await fetchGoogleRoute(safeOrigin, safeDestination);
    if (googleRoute) return googleRoute;
  } catch (error) {
    console.error("Maps fallback:", error.message);
  }

  return buildFallbackRoute(safeOrigin, safeDestination);
}

module.exports = {
  getRouteDetails,
};

