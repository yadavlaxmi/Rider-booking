const test = require("node:test");
const assert = require("node:assert/strict");

const { getRouteDetails } = require("./mapsService");

test("getRouteDetails uses fallback when no Google key", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;

  const route = await getRouteDetails({
    origin: { latitude: 28.6139, longitude: 77.209 },
    destination: { latitude: 28.63, longitude: 77.23 },
  });

  assert.equal(route.provider, "fallback");
  assert.ok(route.distanceKm > 0);
  assert.ok(route.estimatedMinutes > 0);
  assert.ok(Array.isArray(route.polyline));
});

