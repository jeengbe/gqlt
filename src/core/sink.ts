const sinks: { [K in keyof Sinks]?: Sinks[K][] } = {};

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style -- Need this for extending
  interface Sinks { }
}

type Sink<K extends keyof Sinks> =
  Sinks[K][]
  & (
    Sinks[K] extends (...args: infer A) => infer R ? {
      call(...args: A): R[];
    } : Record<string, never>
  );

// TODO: DOCS Note that .call is always attached
export function sink<K extends keyof Sinks>(key: K): Sink<K>;
export function sink<K extends keyof Sinks>(key: K, value: Sinks[K]): void;
export function sink<K extends keyof Sinks>(key: K, value?: Sinks[K]): Sink<K> | void {
  if (typeof value === "undefined") {
    // We don't actually check whether an array of functions is returned and then determine whether to attach a `.call`
    // This way, we rely solely on TS to ensure that it is only called when supposed to
    if (!(key in sinks)) {
      const r = [] as unknown as Sink<K>;
      r.call = () => [];
      return r;
    }

    const r = sinks[key] as Sink<K>;
    r.call = (...args: any[]) => sinks[key]!.map((val: (..._: typeof args) => void) => val(...args));
    return r;
  }

  if (key in sinks) {
    sinks[key]!.push(value);
  } else {
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- Read the below comment first. But for reasons, this only seems to be the case some times, which is why we can't always expect an error
    // @ts-ignore -- Weirdly, for reasons I don't understand, this line appears not to be valid
    sinks[key] = [value];
  }
}
