import "source-map-support/register";

import fancyLog from "fancy-log";
import * as fs from "fs";
import * as path from "path";
import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";

// This file is used to build the gulpfile.js folder
// The reason we need a script for that is that we need to consider all modules that add stuff to the gulpfile
// We pretend that /src/modules/**/gulp/* actually lives in /gulpfile.ts/modules/**/gulp/*
// This is done by changing all sourceFiles' file names to point to the new location

const tsconfigPath = path.resolve(__dirname, "..", "gulpfile.ts", "tsconfig.json");

const host = ts.createWatchCompilerHost(
  tsconfigPath,
  {},
  ts.sys,
  ts.createSemanticDiagnosticsBuilderProgram,
  diag => ts.formatDiagnostic(diag, {
    getCanonicalFileName: ts.identity,
    getCurrentDirectory: ts.sys.getCurrentDirectory.bind(ts.sys),
    getNewLine: () => ts.sys.newLine
  }),
  diag => {
    const log = {
      [ts.DiagnosticCategory.Error]: fancyLog.error.bind(fancyLog),
      [ts.DiagnosticCategory.Warning]: fancyLog.warn.bind(fancyLog),
      [ts.DiagnosticCategory.Message]: fancyLog.info.bind(fancyLog),
      [ts.DiagnosticCategory.Suggestion]: fancyLog.info.bind(fancyLog)
    }[diag.category];

    log(diag.messageText);
  }
);

// TODO: Update paths to work in all environments

const oldAfterProgramCreate = host.afterProgramCreate?.bind(host);
host.afterProgramCreate = (...[program]) => {
  // Force TS to emit all module related stuff from src/modules into gulpfile.js/modules
  const oldEmit = program.emit.bind(program);
  program.emit = (...emitArgs: Parameters<typeof oldEmit>) => {
    // We do this by temporarily updating affected sourceFile's file names whilst emitting since that's where TS gets information about the output path
    const modified: [ts.SourceFile, string][] = [];
    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.fileName.includes("src/modules")) {
        modified.push([sourceFile, sourceFile.fileName]);
        sourceFile.fileName = sourceFile.fileName.replace("src/modules", "gulpfile.ts/modules");
      }
    }

    fs.rmSync(path.resolve(__dirname, "..", "gulpfile.js"), { recursive: true, force: true });
    const r = oldEmit(...emitArgs);

    // Revert changes to file names
    modified.forEach(([sourceFile, orig]) => (sourceFile.fileName = orig));
    return r;
  };

  oldAfterProgramCreate?.(program);
  void replaceTscAliasPaths({
    configFile: tsconfigPath
  });
};

// As this value is determined and cached before afterProgramCreate (our file replacement logic) is called, we also need to patch this method
const oldGetCommonSourceDirectory = ts.getCommonSourceDirectory.bind(ts);
ts.getCommonSourceDirectory = (...getCommonSourceDirectoryArgs) => {
  getCommonSourceDirectoryArgs[0].rootDir = path.resolve(__dirname, "..", "gulpfile.ts");
  return oldGetCommonSourceDirectory(...getCommonSourceDirectoryArgs);
};

ts.createWatchProgram(host);
