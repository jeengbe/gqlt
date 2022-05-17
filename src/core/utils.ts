import type { SpawnOptions } from "child_process";
import { spawn } from "child_process";

export abstract class Type<T> {
  constructor(
    protected readonly data: T
  ) { }

  /**
   * This method is used to save the current changes to the database
   * Each type must implement this method so that it saves exactly the data is operates on
   *
   * @example
   * ```ts
   * async save() {
   *   await query`
   *     LET data = {
   *       name: ${this.data.name},
   *       path: ${this.data.path}
   *     }
   *
   *     UPSERT {
   *       _key: ${this.data._key}
   *     } INSERT MERGE({
   *       _key: ${this.data._key}
   *     }, data) UPDATE data IN modules
   *   `;
   * }
   * ```
   */
  abstract save(): Promise<void> | void;

  /**
   * This method is used to validate and format data and must be implemented in each type accordingly
   *
   * @example
   * ```ts
   * static async formatData(data: unknown): Promise<IModule> {
   *   if (!isRecordUnknown(data)) throw new DataError();
   *   if (!isString(data.path)) throw new DataError("path");
   *   if (!isString(data.name)) throw new DataError("name");
   *
   *   return {
   *     _key: data.path.replace(/\//g, "_"),
   *     name: data.name,
   *     path: data.path,
   *   };
   * }
   * ```
   */
  static async formatData(data: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
}

export abstract class Scalar<T> {
  constructor(
    protected readonly data: T
  ) { }
}

export class ValidationError extends Error { }
export class DataError extends Error { }

export const exec = (command: string, args?: string[], options?: SpawnOptions) => {
  const process = spawn(command, args ?? [], { stdio: "inherit", ...options });
  return process;
};

export function randomHex(length = 6) {
  let r = "";
  while (r.length < length) {
    r += Math.random().toString(16).substring(2);
  }
  return r.substring(0, length);
}

export function isRecordUnknown<K extends keyof any = string>(value: unknown): value is Record<K, unknown> {
  return typeof value === "object" && Boolean(value);
}

/**
 * @param minLength Minimum array length, allows `undefined` if `false`
 */
export function isArray<T>(value: unknown, typeGuard = function (val: unknown): val is T {
  return true;
}, minLength: number | false = 0): value is T[] {
  return (minLength === false && value === undefined) || (Array.isArray(value) && value.length >= minLength && value.every(typeGuard));
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}
