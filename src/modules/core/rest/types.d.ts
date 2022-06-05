export type Args<Path> = Path extends `/${infer Rest}` ? { [key in keyof ArgsWorker<Rest>]: ArgsWorker<Rest>[key] } : "Missing leading slash";

export type ArgsWorker<Path> =
  Path extends `${infer Part}/${infer Rest}`
    ? ArgsWorker<Part> & ArgsWorker<Rest>
    : Path extends `[${infer Arg}]`
      ? Arg extends `...${infer Arg2}`
        ? Record<Arg2, string[]>
        : Record<Arg, string>
      : {};
