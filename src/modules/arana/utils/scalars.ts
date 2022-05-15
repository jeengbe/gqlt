import type { Scalar } from "@core/types";

export declare type VersionString = Scalar<string, "VersionString">;
export declare type Timestamp = Scalar<integer, "Timestamp">;

export function isVersionString(value: unknown): value is VersionString {
  if (typeof value !== "string") return false;
  return /^(?<major>0|(?:[1-9]\d*))\.(?<minor>0|(?:[1-9]\d*))(?:\.(?<patch>0|(?:[1-9]\d*)))?$/.test(value);
}

export function isTimestamp(value: unknown): value is Timestamp {
  return typeof value === "number";
}
