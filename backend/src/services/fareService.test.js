const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateFare } = require("./fareService");

test("calculateFare returns stable numeric estimate", () => {
  process.env.BASE_FARE = "40";
  process.env.PER_KM_RATE = "12";
  process.env.PER_MINUTE_RATE = "2";
  process.env.PEAK_MULTIPLIER = "1";

  const out = calculateFare({ routeDistanceKm: 10, estimatedMinutes: 20 });

  assert.equal(out.currency, "INR");
  assert.equal(out.baseFare, 40);
  assert.equal(out.perKmRate, 12);
  assert.equal(out.perMinuteRate, 2);
  assert.equal(out.peakMultiplier, 1);
  assert.equal(out.routeDistanceKm, 10);
  assert.equal(out.estimatedMinutes, 20);
  assert.equal(out.estimatedFare, 40 + 10 * 12 + 20 * 2);
});

