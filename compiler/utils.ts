import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { __src } from "./compile";

export function not<Args extends any[]>(predicate: (...args: Args) => boolean) {
  return (...args: Args) => !predicate(...args);
}

export function and<Args extends any[]>(...predicates: ((...args: Args) => boolean)[]) {
  return (...args: Args) => predicates.every(p => p(...args));
}

export function or<Args extends any[]>(...predicates: ((...args: Args) => boolean)[]) {
  return (...args: Args) => predicates.some(p => p(...args));
}

export function isNodeModule(sourceFile: ts.SourceFile): boolean {
  return sourceFile.fileName.includes("node_modules");
}

export function isModuleApiSourceFile(sourceFile: ts.SourceFile): boolean {
  return isModuleApiFile(sourceFile.fileName);
}

export function isModuleApiFile(fileName: string): boolean {
  if (!fileName.endsWith(".ts") || fileName.endsWith(".d.ts")) return false;
  const yml = getModuleYmlPath(fileName);
  if (!yml) return false;
  return fileName.substring(yml.length - "/module.yml".length).startsWith("/api/");
}

export function getModuleYmlPath(sourceFileName: string): string | false {
  const dir = path.dirname(sourceFileName);
  if (dir === sourceFileName) return false;
  const moduleYmlPath = path.join(dir, "module.yml");
  if (fs.existsSync(moduleYmlPath)) return moduleYmlPath;
  return getModuleYmlPath(dir);
}

export function isModuleFile(fileName: string) {
  return path.normalize(fileName).startsWith(path.resolve(__src, "modules"));
}

export function getModuleScopeFileName(fileName: string) {
  return path.normalize(fileName).substring((__src + "/modules/").length, path.normalize(fileName).length - 3).replace(/\\/g, "/");
}
