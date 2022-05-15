import type { Scalar } from "@core/types";

export type Author = Scalar<string, "Author">;

export function isAuthor(value: unknown): value is Author {
  return typeof value === "string";
}
