import { Scalar } from "@core/types";

export declare type VersionString = Scalar<string, "VersionString">;
export declare type Timestamp = Scalar<integer, "Timestamp">;

export function isVersionString(version: unknown): version is VersionString {
  if (typeof version !== "string") return false;
  return /^(?<major>0|(?:[1-9]\d*))\.(?<minor>0|(?:[1-9]\d*))(?:\.(?<patch>0|(?:[1-9]\d*)))?$/.test(version);
}
