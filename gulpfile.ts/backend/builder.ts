import fancyLog from "fancy-log";
import * as fs from "fs";
import * as path from "path";
import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";
import { __dist, __src } from "../paths";
import { sink } from "../sink";
import { walkDir } from "../utils";
import type { WatchType } from "./utils";

declare global {
  interface Sinks {
    /**
     * Called as soon as a builder instance is created
     */
    setBuilder(instance: Builder): void;
    /**
     * Used to modify the content of a file
     *
     * @param fileName The file name
     * @param content The content of the file
     * @return New content of the file
     */
    readFile(fileName: string, content: string | undefined): string | void;
    createProgram(): void;
    afterProgramCreate(watch: WatchType): void;
    /**
     * @return `false` if should not emit
     */
    afterProgramRecreate(watch: ts.SemanticDiagnosticsBuilderProgram): boolean | void;
  }
}

export class Builder {
  protected readonly host: ts.WatchCompilerHostOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>;
  protected readonly system: ts.System;
  protected watch?: WatchType;

  protected readonly oldReadFile: typeof this.host.readFile;
  protected readonly oldCreateProgram: typeof this.host.createProgram;
  protected readonly oldAfterProgramCreate: typeof this.host.afterProgramCreate;

  constructor(
    protected readonly tsconfigPath: string
  ) {
    this.system = ts.sys;

    const tsconfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, {
      ...this.system,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        this.reportDiagnostic(diagnostic);
        process.exit(1);
      }
    })!;

    sink("setBuilder").call(this);

    this.host = ts.createWatchCompilerHost(
      tsconfigPath,
      {
        ...tsconfig.options,
        extendedDiagnostics: false
      },
      this.system,
      ts.createSemanticDiagnosticsBuilderProgram,
      this.reportDiagnostic.bind(this),
      this.reportWatchStatus.bind(this)
    );

    // We patch these, so we need to store a reference to their originals
    this.oldReadFile = this.host.readFile.bind(this.host);
    this.host.readFile = this.readFile.bind(this);
    this.oldCreateProgram = this.host.createProgram.bind(this.host);
    this.host.createProgram = this.createProgram.bind(this);
    this.oldAfterProgramCreate = this.host.afterProgramCreate?.bind(this.host);
    this.host.afterProgramCreate = this.afterProgramCreate.bind(this);
  }

  public run() {
    // This cast is ok as we patch TS to expose the extra variables and methods
    this.watch = ts.createWatchProgram(this.host) as WatchType;

    sink("afterProgramCreate").call(this.watch);
  }

  protected readFile: typeof this.oldReadFile = (...args) => {
    const [fileName] = args;

    return sink("readFile").reduce((prev, fn) => {
      const s = fn(fileName, prev);
      if (typeof s === "string") {
        return s;
      }
      return prev;
    }, this.oldReadFile(...args));
  };

  protected createProgram: typeof this.oldCreateProgram = (...args) => {
    sink("createProgram").call();

    return this.oldCreateProgram(...args);
  };

  protected afterProgramCreate: NonNullable<typeof this.oldAfterProgramCreate> = (...args) => {
    const [program] = args;

    if (sink("afterProgramRecreate").call(program).every(v => v !== false)) {
      this.oldAfterProgramCreate?.(...args);
      this.afterEmit();
    }
  };

  protected afterEmit() {
    void replaceTscAliasPaths({
      configFile: this.tsconfigPath
    });

    let copied = 0;
    walkDir(__src, (f, rel, abs) => {
      if (f.endsWith(".yml")) {
        fs.copyFileSync(abs, path.resolve(__dist, rel, f));
        copied++;
      }
    });
    this.reportWatchStatus(`Copied ${copied} .yml file${copied === 1 ? "" : "s"}.`);
  }

  protected reportDiagnostic: ts.DiagnosticReporter = (diagnostic) => {
    const log = {
      [ts.DiagnosticCategory.Error]: fancyLog.error.bind(fancyLog),
      [ts.DiagnosticCategory.Warning]: fancyLog.warn.bind(fancyLog),
      [ts.DiagnosticCategory.Message]: fancyLog.info.bind(fancyLog),
      [ts.DiagnosticCategory.Suggestion]: fancyLog.info.bind(fancyLog)
    }[diagnostic.category];

    log(ts.formatDiagnostic(diagnostic, {
      getCanonicalFileName: ts.identity,
      getCurrentDirectory: this.system.getCurrentDirectory.bind(this.system),
      getNewLine: () => this.system.newLine
    }));
  };

  public reportWatchStatus(diagnostic: ts.Diagnostic | string): void {
    fancyLog(typeof diagnostic === "string" ? diagnostic : diagnostic.messageText);
  }
}
