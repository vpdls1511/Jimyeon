export const DEFAULT_DIVIDER_OPACITY = 0.5;

export function dividerOpacity(value) {
  const number = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : DEFAULT_DIVIDER_OPACITY;
}
