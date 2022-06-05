const sinks: { [K in keyof Sinks]?: Sinks[K][] } = {};

/**
 * Get all items for a sink
 *
 * @example
 * ```ts
 * for(const item of sink("core/server/middleware")) { ... }
 * ```
 */
export function sink<S extends keyof Sinks>(name: S): Sinks[S][];
/**
 * Add an item to a sink
 *
 * @example
 * ```ts
 * sink("core/server/middleware"), (req, res, next) => { ... })
 * ```
 */
export function sink<S extends keyof Sinks>(name: S, value: Sinks[S]): void;
export function sink<S extends keyof Sinks>(name: S, value?: Sinks[S]): Sinks[S][] | void {
  if (value !== undefined) {
    if (!(name in sinks)) sinks[name] = [];
    sinks[name]!.push(value);
  } else {
    return name in sinks ? sinks[name] : [];
  }
}
