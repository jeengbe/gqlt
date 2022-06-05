import type { Scalar } from "./types";

declare global {
  // Must use these in-built scalars if applicable
  type integer = Scalar<number, "Integer">;
  type float = Scalar<number, "Float">;
  type id = Scalar<string, "Id">;
}
