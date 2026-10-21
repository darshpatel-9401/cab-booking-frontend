export function formatMoney(amount, currency) {
  try {
    return (amount / 100).toLocaleString(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    });
  } catch (err) {
    return `${amount / 100} ${currency.toUpperCase()}`;
  }
}

export function formatDistance(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(secs) {
  return `${Math.max(1, Math.round(secs / 60))} min`;
}