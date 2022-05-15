import type { Scalar } from "./types";

declare global {
  type integer = Scalar<number, "Integer">;
  type float = Scalar<number, "Float">;
  type id = Scalar<string, "Id">;
}
