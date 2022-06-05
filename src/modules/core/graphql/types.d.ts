import type { MaybePromise } from "@core/types";

export type Scalar<T, K extends string> = Omit<T, "__scalar"> & { __scalar: K; };
export type Resolver<T> = MaybePromise<T>;

export interface Document {
  _id?: string;
  _ref?: string;
  _key?: string;
}

export interface Edge<From, To> extends Document {
  _from: string;
  _to: string;
}
