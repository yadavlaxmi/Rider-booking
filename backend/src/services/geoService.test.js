const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateDistanceKm } = require("./geoService");

test("calculateDistanceKm returns ~0 for identical points", () => {
  const dist = calculateDistanceKm(
    { latitude: 28.6139, longitude: 77.209 },
    { latitude: 28.6139, longitude: 77.209 }
  );
  assert.ok(dist >= 0);
  assert.ok(dist < 0.001);
});

test("calculateDistanceKm returns a positive value for different points", () => {
  const dist = calculateDistanceKm(
    { latitude: 28.6139, longitude: 77.209 },
    { latitude: 28.63, longitude: 77.23 }
  );
  assert.ok(dist > 0);
  assert.ok(dist < 10);
});

