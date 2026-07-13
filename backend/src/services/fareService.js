function getPricingConfig() {
  return {
    baseFare: Number(process.env.BASE_FARE || 40),
    perKmRate: Number(process.env.PER_KM_RATE || 12),
    perMinuteRate: Number(process.env.PER_MINUTE_RATE || 2),
    peakMultiplier: Number(process.env.PEAK_MULTIPLIER || 1),
  };
}

function calculateFare({ routeDistanceKm, estimatedMinutes }) {
  const pricing = getPricingConfig();
  const subtotal =
    pricing.baseFare +
    Number(routeDistanceKm) * pricing.perKmRate +
    Number(estimatedMinutes) * pricing.perMinuteRate;

  const total = subtotal * pricing.peakMultiplier;

  return {
    currency: "INR",
    baseFare: pricing.baseFare,
    perKmRate: pricing.perKmRate,
    perMinuteRate: pricing.perMinuteRate,
    peakMultiplier: pricing.peakMultiplier,
    routeDistanceKm: Number(Number(routeDistanceKm).toFixed(2)),
    estimatedMinutes: Number(estimatedMinutes),
    estimatedFare: Number(total.toFixed(2)),
  };
}

module.exports = {
  calculateFare,
};

