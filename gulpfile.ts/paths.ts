import * as path from "path";

// We are safe to do this as cwd is always set correctly
export const __dist = path.resolve("dist");
export const __src = path.resolve("src");
export const __gulpjs = path.resolve("gulpfile.js");
export const __gulpts = path.resolve("gulpfile.ts");
