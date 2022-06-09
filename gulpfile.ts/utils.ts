import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
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

export const walkDir = (dir: string, cb: (fileName: string, relativePath: string, absolutePath: string, isDir: boolean) => boolean | void, recursive = true) => {
  walkDirWorker(dir, cb, recursive);
};

const walkDirWorker = (dir: string, cb: (fileName: string, relativePath: string, absolutePath: string, isDir: boolean) => boolean | void, recursive = true, sub: string[] = []) => {
  const d = path.join(dir, ...sub);
  for (const file of fs.readdirSync(d)) {
    const f = path.join(d, file);
    const isDir = fs.statSync(f).isDirectory();
    if (cb(file, path.join(...sub), f, isDir) !== false && isDir && recursive) {
      walkDirWorker(dir, cb, recursive, [...sub, file]);
    }
  }
};
