import { spawn } from "child_process";
import type Undertaker from "undertaker";

export const task = (fn: (...args: any[]) => any, description?: string, flags?: Undertaker.TaskFlags, displayName?: string): Undertaker.TaskFunction => {
  const r = ((...args: any[]) => fn(...args)) as Undertaker.TaskFunction;
  r.description = description;
  r.displayName = displayName;
  r.flags = flags;

  return r;
};

export const exec = (command: string, args?: string[]) => {
  const process = spawn(command, args ?? [], { stdio: "inherit" });
  return process;
};
