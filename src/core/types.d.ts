import type { RequestHandler } from "express";

export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;

declare global {
  interface Sinks {
    "core/server/middleware": RequestHandler;
  }

  namespace NodeJS {
    // TODO: Type-check .env
    export interface ProcessEnv {
      DATABASE_URL: string;
      DATABASE_NAME: string;
      DATABASE_USER: string;
      DATABASE_PASSWORD: string;
    }
  }
}
