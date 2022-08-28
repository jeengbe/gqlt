import fancyLog from "fancy-log";
import * as path from "path";
import "source-map-support/register";
import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";

const tsconfigPath = path.resolve(__dirname, "gulpfile.ts", "tsconfig.json");
const tsconfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, ts.sys as unknown as ts.ParseConfigFileHost)!;

// Here, we use a custom compiler program to compile all src/modules/*/**gulp/* stuff into gulpfile.js/modules
// This is done by changing all sourceFile's file names to point to the new location

const host = ts.createWatchCompilerHost(
  tsconfigPath,
  tsconfig.options,
  ts.sys,
  ts.createSemanticDiagnosticsBuilderProgram,
  diag => ts.formatDiagnostic(diag, {
    getCanonicalFileName: ts.identity,
    getCurrentDirectory: ts.sys.getCurrentDirectory.bind(ts.sys),
    getNewLine: () => ts.sys.newLine
  }),
  diag => fancyLog(diag.messageText)
);

// TODO: Update paths to work in all environments

const oldAfterProgramCreate = host.afterProgramCreate?.bind(host);
host.afterProgramCreate = (...args: Parameters<Exclude<typeof oldAfterProgramCreate, undefined>>) => {
  const [program] = args;

  // Force TS to emit all module related stuff from src/modules into gulpfile.js/modules
  const oldEmit = program.emit.bind(program);
  program.emit = (...args2: Parameters<typeof oldEmit>) => {
    // We do this by temporarily updating affected sourceFile's file names whilst emitting since that's where TS gets information about the output path
    const modified: [ts.SourceFile, string][] = [];
    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.fileName.includes("src/modules")) {
        modified.push([sourceFile, sourceFile.fileName]);
        sourceFile.fileName = sourceFile.fileName.replace("src/modules", "gulpfile.ts/modules");
      }
    }

    const r = oldEmit(...args2);

    // Revert changes to file names
    modified.forEach(([sourceFile, orig]) => (sourceFile.fileName = orig));
    return r;
  };

  oldAfterProgramCreate?.(...args);
  void replaceTscAliasPaths({
    configFile: tsconfigPath
  });
};

// As this value is determined and cached before afterProgramCreate (our file replacement logic) is called, we also need to patch this method
const oldGetCommonSourceDirectory = ts.getCommonSourceDirectory.bind(ts);
ts.getCommonSourceDirectory = (...args: Parameters<typeof ts.getCommonSourceDirectory>) => {
  args[0].rootDir = "/home/coder/gqlt/gulpfile.ts";
  return oldGetCommonSourceDirectory(...args);
};

ts.createWatchProgram(host);
