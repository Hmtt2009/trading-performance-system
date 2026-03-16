export function toNullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}
