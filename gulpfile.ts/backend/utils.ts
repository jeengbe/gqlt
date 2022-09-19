import * as fs from "fs";
import * as path from "path";
import type ts from "typescript";
import type { SchemaArgument, SchemaField, SchemaOutputType, SchemaScalar, SchemaType } from "../../src/modules/core/graphql/generated/schema";
import { __src } from "../paths";

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
  return path.normalize(fileName).substring((`${__src}/modules/`).length, path.normalize(fileName).length - (fileName.endsWith(".d.ts") ? 5 : 3)).replace(/\\/g, "/");
}

type CompareSchemaType = SchemaType | SchemaScalar | SchemaField | SchemaOutputType | SchemaArgument;
type CompareType = string | boolean | number | CompareSchemaType | undefined;

export function areTypesEqual(typeA: CompareType, typeB: CompareType): boolean {
  if (typeA === typeB) return true;
  if (typeA === undefined || typeB === undefined) return false;
  if (["string", "boolean", "number"].includes(typeof typeA)) return false;
  if (["string", "boolean", "number"].includes(typeof typeB)) return false;
  const a = typeA as CompareSchemaType;
  const b = typeB as CompareSchemaType;
  if (a.kind !== b.kind) return false;

  return Object.keys(a).every(key => areTypesEqual(a[key as keyof typeof a], b[key as keyof typeof a]));
}

interface FilePresentOnHost {
  version: string;
  sourceFile: ts.SourceFile;
  fileWatcher: ts.FileWatcher;
}
type FileMissingOnHost = false;
interface FilePresenceUnknownOnHost {
  version: false;
  fileWatcher?: ts.FileWatcher;
}
type HostFileInfo = FilePresentOnHost | FileMissingOnHost | FilePresenceUnknownOnHost;

export type WatchType = ts.WatchOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram> & { sourceFilesCache: Map<string, HostFileInfo>; synchronizeProgram(): void; };
