export type Resolver<T> = T | Promise<T>;
export type MaybeArray<T> = T | T[];
export type Scalar<T, K extends string> = Omit<T, "__scalar"> & { __scalar: K; };

export interface Document {
  _id?: string;
  _ref?: string;
  _key?: string;
}

export interface Edge<From, To> extends Document {
  _from: string;
  _to: string;
}
