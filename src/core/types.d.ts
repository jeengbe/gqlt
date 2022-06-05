import type { RequestHandler } from "express";
export type Resolver<T> = MaybePromise<T>;
export type Scalar<T, K extends string> = Omit<T, "__scalar"> & { __scalar: K; };
export type Args<Path> = Path extends `/${infer Rest}` ? { [key in keyof ArgsWorker<Rest>]: ArgsWorker<Rest>[key] } : "Missing leading slash";
export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;

declare global {
  interface Sinks {
    "core/server/middleware": MaybePromise<RequestHandler>;
  }

  namespace NodeJS {
    // TODO: Type this
    export interface ProcessEnv {
      DATABASE_URL: string;
      DATABASE_NAME: string;
      DATABASE_USER: string;
      DATABASE_PASSWORD: string;
    }
  }
}

export type ArgsWorker<Path> =
  Path extends `${infer Part}/${infer Rest}`
    ? ArgsWorker<Part> & ArgsWorker<Rest>
    : Path extends `[${infer Arg}]`
      ? Arg extends `...${infer Arg2}`
        ? Record<Arg2, string[]>
        : Record<Arg, string>
      : {};

export interface Document {
  _id?: string;
  _ref?: string;
  _key?: string;
}

export interface Edge<From, To> extends Document {
  _from: string;
  _to: string;
}
