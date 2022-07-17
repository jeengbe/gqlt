const sinks: {
  [K in keyof Sinks]?: { value: Sinks[K]; priority: number; }[]
} = {};

export enum Priority {
  LOWEST = -2,
  LOW = -1,
  DEFAULT = 0,
  HIGH = 1,
  HIGHEST = 2
}

declare global {
  interface Sinks {
    /**
     * Request inclusion of all files in the given directoryf or all modules
     * @example
     * ```ts
     * sink("core/scanModules", "rest"); // Will include all files in rest/ for each module
     * ```
     */
    "core/scanModules": string;
  }
}

type Sink<K extends keyof Sinks> =
  Sinks[K] extends (...args: infer A) => infer R ?
    Sinks[K][] & {
      call(...args: A): R[];
    }
    : Sinks[K][];

// TODO: DOCS Note that .call is always attached
export function sink<K extends keyof Sinks>(key: K): Sink<K>;
export function sink<K extends keyof Sinks>(key: K, value: Sinks[K], priority?: Priority | number): void;
export function sink<K extends keyof Sinks>(key: K, value?: Sinks[K], priority?: number): Sink<K> | void {
  if (typeof value === "undefined") {
    // We don't actually check whether an array of functions is returned and then determine whether to attach a `.call`
    // This way, we rely solely on TS to ensure that it is only called when supposed to
    if (!(key in sinks)) {
      const r = [] as unknown as Sink<K>;
      // @ts-expect-error -- As noted above, we attach this method regardless of type and hope for the best (Thank you TS)
      r.call = () => [];
      return r;
    }

    const r = sinks[key]!.sort((s1, s2) => s2.priority - s1.priority).map(s => s.value) as Sink<K>;
    // @ts-expect-error -- see above
    r.call = (...args: any[]) => sinks[key]!.map((val: (..._: typeof args) => void) => val(...args));
    return r;
  }

  if (key in sinks) {
    sinks[key]!.push({ value, priority: priority ?? Priority.DEFAULT });
  } else {
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- Read the below comment first. But for reasons, this only seems to be the case some times, which is why we can't always @ts-expect-error
    // @ts-ignore -- Weirdly, for reasons I don't understand, this line appears not to be valid
    sinks[key] = [{ value, priority: priority ?? Priority.DEFAULT }];
  }
}
