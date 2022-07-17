import type { SpawnOptions } from "child_process";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export class ValidationError extends Error { }
export class DataError extends Error { }

export const exec = (command: string, args?: string[], options?: SpawnOptions) => {
  const process = spawn(command, args ?? [], { stdio: "inherit", ...options });
  return process;
};

export async function importAll(p: string, awaitDefault = false) {
  if (fs.existsSync(p)) {
    await walkDirAsync(p, async (f, __, abs) => {
      if (f.endsWith(".js") && !f.endsWith(".test.js")) {
        const i = await import(abs);
        if (awaitDefault && "default" in i) {
          await i.default();
        }
      }
    });
  }
}

export function randomHex(length = 6) {
  let r = "";
  while (r.length < length) {
    r += Math.random().toString(16).substring(2);
  }
  return r.substring(0, length);
}

export function walkDir(dir: string, cb: (fileName: string, relativePath: string, absolutePath: string, isDir: boolean) => boolean | void, recursive = true) {
  walkDirWorker(dir, cb, recursive);
}

function walkDirWorker(dir: string, cb: (fileName: string, relativePath: string, absolutePath: string, isDir: boolean) => boolean | void, recursive = true, sub: string[] = []) {
  const d = path.join(dir, ...sub);
  for (const file of fs.readdirSync(d)) {
    const f = path.join(d, file);
    const isDir = fs.statSync(f).isDirectory();
    if (cb(file, path.join(...sub), f, isDir) !== false && isDir && recursive) {
      walkDirWorker(dir, cb, recursive, [...sub, file]);
    }
  }
}

export async function walkDirAsync(dir: string, cb: (fileName: string, relativePath: string, absolutePath: string, isDir: boolean) => Promise<boolean | void>, recursive = true) {
  await walkDirAsyncWorker(dir, cb, recursive);
}

async function walkDirAsyncWorker(dir: string, cb: (fileName: string, relativePath: string, absolutePath: string, isDir: boolean) => Promise<boolean | void>, recursive = true, sub: string[] = []) {
  const d = path.join(dir, ...sub);
  for (const file of fs.readdirSync(d)) {
    const f = path.join(d, file);
    const isDir = fs.statSync(f).isDirectory();
    if (await cb(file, path.join(...sub), f, isDir) !== false && isDir && recursive) {
      await walkDirAsyncWorker(dir, cb, recursive, [...sub, file]);
    }
  }
}
