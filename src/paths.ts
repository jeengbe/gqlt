import * as fs from "fs";
import * as path from "path";

// We are safe to do this as cwd is always set correctly
export const __dist = path.resolve("dist");
export const __core = path.resolve(__dist, "core");
export const __modules = path.resolve(__dist, "modules");
export const __temp = path.resolve("temp");
export const __files = path.resolve("files");

fs.rmSync(__temp, { recursive: true, force: true });
fs.mkdirSync(__temp);
if (!fs.existsSync(__files)) fs.mkdirSync(__files);
