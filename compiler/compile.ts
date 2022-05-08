import * as path from "path";
import ts from "typescript";
import { build } from "./build";
import { scan } from "./scan";

export const __src = path.resolve("src");

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: path => path,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine
};

// Prepare config
const tsconfigPath = path.resolve(__src, "tsconfig.json");
const tsconfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, ts.sys as unknown as ts.ParseConfigFileHost)!;
const options: ts.CreateProgramOptions = {
  rootNames: tsconfig.fileNames,
  options: tsconfig.options,
  projectReferences: tsconfig.projectReferences,

  host: ts.createCompilerHost(tsconfig.options)
};

const types = scan(options);
build(options, types, tsconfigPath, tsconfig, formatHost);
