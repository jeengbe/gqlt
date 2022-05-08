import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";
import type { Schema } from "../src/core/schema";
import { isModuleApiFile } from "./utils";

export function build(options: Omit<ts.CreateProgramOptions, "host">, types: Schema, tsconfigPath: string, tsconfig: ts.ParsedCommandLine, formatHost: ts.FormatDiagnosticsHost) {
  const host = ts.createWatchCompilerHost(
    tsconfigPath,
    tsconfig.options,
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    diagnosticReporter,
    watchStatusReporter
  );

  function diagnosticReporter(diagnostic: ts.Diagnostic): void {
    console.error(ts.formatDiagnostic(diagnostic, formatHost));
  }

  function watchStatusReporter(diagnostic: ts.Diagnostic): void {
    console.log(ts.formatDiagnostic(diagnostic, formatHost));
  }

  const typesRegex = new RegExp(`new (${Object.keys(types).join("|")})`, "g");

  const origReadFile = host.readFile.bind(host);
  host.readFile = (fileName: string) => {
    if (fileName.endsWith("core/generated/schema.json")) {
      return JSON.stringify(types, null, 2);
    } else if (isModuleApiFile(fileName)) {
      let content = origReadFile(fileName);
      content = content?.replace(typesRegex, `new __classes.$1`);

      return `import __classes from "@classes";
${content}`;
    } else {
      return origReadFile(fileName);
    }
  };

  const origAfterProgramCreate = host.afterProgramCreate?.bind(host);
  host.afterProgramCreate = (...args) => {
    origAfterProgramCreate?.(...args);

    replaceTscAliasPaths({
      configFile: tsconfigPath,
    });
  };


  ts.createWatchProgram(host);
}
