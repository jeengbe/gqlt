import type { SpawnOptions } from "child_process";
import { spawn } from "child_process";

export type ConstructorData<T> = { [K in keyof T]?: unknown };

export abstract class Type<T> {
  constructor(
    protected readonly data: T
  ) {
    // eslint-disable-next-line no-constructor-return -- This is required as well to return both the instance and formatted data
    return { instance: this, data: "_unaltered" in data ? {} : data } as unknown as this;
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

export function isString(value: unknown): value is string {
  return typeof value === "string";
}
