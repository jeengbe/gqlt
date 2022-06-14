import { formatHost } from "@gulp/utils";
import fancyLog from "fancy-log";
import * as fs from "fs";
import * as path from "path";
import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";
import { __dist, __src } from "../paths";
import { sink } from "../sink";
import { walkDir } from "../utils";

declare global {
  interface Sinks {
    setBuilder(builder: Builder): void;
    readFile(fileName: string, content: string | undefined): string | void;
    createProgram(): void;
    afterProgramCreate(watch: WatchType): void;
    afterProgramRecreate(watch: ts.SemanticDiagnosticsBuilderProgram): boolean | void;
  }
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

export type WatchType = InstanceType<typeof Builder>["watch"];

export class Builder {
  protected readonly host: ts.WatchCompilerHostOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>;
  protected readonly system: ts.System;
  protected readonly watch: ts.WatchOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram> & { sourceFilesCache: Map<string, HostFileInfo>; synchronizeProgram(): void; };

  protected readonly oldReadFile: typeof this.host["readFile"];
  protected readonly oldCreateProgram: typeof this.host["createProgram"];
  protected readonly oldAfterProgramCreate: typeof this.host["afterProgramCreate"];

  constructor(
    protected readonly tsconfigPath: string,
    protected readonly tsconfig: ts.ParsedCommandLine
  ) {
    this.system = ts.sys;

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

    // We patch these, so we need a reference to their original
    this.oldReadFile = this.host.readFile.bind(this.host);
    this.host.readFile = this.readFile.bind(this);
    this.oldCreateProgram = this.host.createProgram.bind(this.host);
    this.host.createProgram = this.createProgram.bind(this);
    this.oldAfterProgramCreate = this.host.afterProgramCreate?.bind(this.host);
    this.host.afterProgramCreate = this.afterProgramCreate.bind(this);

    // This cast is ok as we patch TS to expose the extra variables and methods
    this.watch = ts.createWatchProgram(this.host) as any;

    sink("afterProgramCreate").call(this.watch);
  }

  protected readFile(...args: Parameters<typeof this.oldReadFile>) {
    const [fileName] = args;

    return sink("readFile").reduce((prev, fn) => {
      const s = fn(fileName, prev);
      if (typeof s === "string") {
        return s;
      }
      return prev;
    }, this.oldReadFile(...args));
  }

  protected createProgram(...args: Parameters<typeof this.oldCreateProgram>) {
    sink("createProgram").call();

    return this.oldCreateProgram(...args);
  }

  protected afterProgramCreate(...args: Parameters<Exclude<typeof this.oldAfterProgramCreate, undefined>>) {
    const [program] = args;

    if (sink("afterProgramRecreate").call(program).every(v => v !== false)) {
      this.oldAfterProgramCreate?.(...args);
      this.afterEmit(program);
    }
  }

  protected afterEmit(program: ts.SemanticDiagnosticsBuilderProgram) {
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
    this.reportWatchStatus(`Copied ${copied} extra file${copied === 1 ? "" : "s"}.`);
  }

  protected reportDiagnostic(diagnostic: ts.Diagnostic): void {
    console.error(ts.formatDiagnostic(diagnostic, formatHost));
  }

  public reportWatchStatus(diagnostic: ts.Diagnostic | string): void {
    fancyLog(typeof diagnostic === "string" ? diagnostic : diagnostic.messageText);
  }
}
