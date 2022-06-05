import type { SpawnOptions } from "child_process";
import { spawn } from "child_process";

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
