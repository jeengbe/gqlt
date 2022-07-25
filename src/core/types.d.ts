
export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;

export type Split<S extends string, D extends string> =
  string extends S ? string[] :
    S extends "" ? [] :
      S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];


declare global {
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
