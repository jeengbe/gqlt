import * as path from "path";
import ts from "typescript";
import { task } from "../utils";
import { Builder } from "./builder";

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: path => path,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine
};

export const __src = path.resolve("src");

export const watch = task(
  () => {
    const tsconfigPath = path.resolve(__src, "tsconfig.json");
    const tsconfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, ts.sys as unknown as ts.ParseConfigFileHost)!;

    new Builder(tsconfigPath, tsconfig, formatHost);
  },
  "Watch for changes to the backend",
  undefined,
  "watch backend"
);
