import * as path from "path";
import ts from "typescript";
import { build } from "./build";
import { scan } from "./scan";

export const __src = path.resolve("src");

// Prepare config
const tsconfigPath = path.resolve(__src, "tsconfig.json");
const tsconfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, ts.sys as unknown as ts.ParseConfigFileHost)!;
const options: ts.CreateProgramOptions = {
  rootNames: tsconfig.fileNames,
  options: tsconfig.options,
  projectReferences: tsconfig.projectReferences,

  host: ts.createCompilerHost(tsconfig.options)
};

performance.mark("scan:start");
const types = scan(options);
performance.mark("scan:end");
performance.mark("build:start");
build(options, types, tsconfigPath);
performance.mark("build:end");

const perfScan = performance.measure("scan", "scan:start", "scan:end")
const perfBuild =  performance.measure("build", "build:start", "build:end")
console.log("Build:", perfScan.duration.toFixed(2), "ms");
console.log("Compile:", perfBuild.duration.toFixed(2), "ms");
console.log("Total:", (perfBuild.duration + perfScan.duration).toFixed(2), "ms");
