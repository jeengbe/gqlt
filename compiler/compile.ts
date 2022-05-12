import * as path from "path";
import ts from "typescript";
import { Builder } from "./builder";

export const __src = path.resolve("src");

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: path => path,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine
};

const tsconfigPath = path.resolve(__src, "tsconfig.json");
const tsconfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, ts.sys as unknown as ts.ParseConfigFileHost)!;

new Builder(tsconfigPath, tsconfig, formatHost);
