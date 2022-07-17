export function isRecordUnknown<K extends keyof any = string>(value: unknown): value is Record<K, unknown> {
  return typeof value === "object" && Boolean(value);
}

/**
 * @param minLength Minimum array length, allows a value of `undefined` if `false`
 */
export function isArray<T>(value: unknown, typeGuard = function (val: unknown): val is T {
  return true;
}, minLength: number | false = 0): value is T[] {
  return (minLength === false && value === undefined) || (Array.isArray(value) && value.length >= minLength && value.every(typeGuard));
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}
