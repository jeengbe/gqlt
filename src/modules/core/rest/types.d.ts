/* eslint-disable @typescript-eslint/no-shadow -- We know what we're doing */

import type { Split } from "@core/types";

export type Args<Path> = Path extends (infer Path)[]
  ? Args<Path>
  : Path extends `/${infer Rest}`
    ? keyof ArgsWorker<Rest> extends never
      ? Record<string, never>
      // This is a neat trick to combine all union members into one single object (and make then readonly)
      : { readonly [key in keyof ArgsWorker<Rest>]: ArgsWorker<Rest>[key] }
    : "Missing leading slash";

export type ArgsWorker<Path> =
  Path extends `${infer Part}/${infer Rest}`
    ? ArgsWorker<Part> & ArgsWorker<Rest>
    : Path extends `:${infer Arg}`
      ? Record<ParseArg<Arg>[0], ParseArg<Arg>[1]>
      : {};

type ParseArg<Arg extends string> = Arg extends `${infer Arg}(${infer _Regex})`
  ? [Arg, string]
  : Arg extends `${infer Arg}[${infer Values}]`
    ? [Arg, Split<Values, "|">[number]] :
    Arg extends `::${infer Arg}`
      ? [ParseArg<Arg>[0], ParseArg<Arg>[1][]]
      : [Arg, Arg extends "id" ? number : string];
