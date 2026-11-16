export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError('clamp arguments must be finite numbers');
  }

  if (min > max) {
    throw new RangeError('clamp minimum must not exceed maximum');
  }

  if (value < min) return min;
  if (value > max) return max;
  return value;
}
