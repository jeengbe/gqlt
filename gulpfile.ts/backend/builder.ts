import fancyLog from "fancy-log";
import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";
import { ScanError, Scanner, UpdateResult } from "./scanner";
import { isModuleApiFile } from "./utils";

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

export class Builder {
  protected readonly host: ts.WatchCompilerHostOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>;
  protected readonly system: ts.System;
  protected readonly scanner: Scanner;
  protected readonly watch: ReturnType<typeof ts.createWatchProgram> & { sourceFilesCache: Map<string, HostFileInfo>; synchronizeProgram(): void; };

  protected readonly oldReadFile: typeof this.host["readFile"];
  protected readonly oldCreateProgram: typeof this.host["createProgram"];
  protected readonly oldAfterProgramCreate: typeof this.host["afterProgramCreate"];

  protected updatedFiles: string[] = [];

  constructor(
    protected readonly tsconfigPath: string,
    protected readonly tsconfig: ts.ParsedCommandLine,
    protected readonly formatHost: ts.FormatDiagnosticsHost
  ) {
    this.system = ts.sys;

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

    this.oldReadFile = this.host.readFile.bind(this.host);
    this.host.readFile = this.readFile.bind(this);
    this.oldCreateProgram = this.host.createProgram.bind(this.host);
    this.host.createProgram = this.createProgram.bind(this);
    this.oldAfterProgramCreate = this.host.afterProgramCreate?.bind(this.host);
    this.host.afterProgramCreate = this.afterProgramCreate.bind(this);

    // This is ok as we patch TS to expose the extra variable
    this.watch = ts.createWatchProgram(this.host) as any;

    this.scanner = new Scanner(this.watch);
    // Force schema to compile
    this.invalidateModuleApiFiles(UpdateResult.SCHEMA);
    this.watch.synchronizeProgram();
  }

  protected readFile(...args: Parameters<typeof this.oldReadFile>) {
    const fileName = args[0];

    if (!this.scanner) {
      return this.oldReadFile(fileName);
    }

    if (fileName.endsWith("schema.json")) {
      return JSON.stringify(this.scanner.getTypes(), null, 2);
    } else if (isModuleApiFile(fileName)) {
      let content = this.oldReadFile(fileName);
      content = content?.replace(this.scanner.getTypesRegex(), `new __classes.$1`);

      return `import __classes from "@classes";
${content}`;
    } else {
      return this.oldReadFile(fileName);
    }
  }

  protected createProgram(...args: Parameters<typeof this.oldCreateProgram>) {
    const oldProgram = args[3];

    if (this.watch) {
      for (const [fileName, cache] of this.watch.sourceFilesCache.entries()) {
        if (cache === false || cache.version === false) {
          this.updatedFiles.push(fileName);
        }
      }
    }

    return this.oldCreateProgram(...args);
  }

  protected afterProgramCreate(...args: Parameters<Exclude<typeof this.oldAfterProgramCreate, undefined>>) {
    if (this.watch) {
      let result;
      try {
        result = Math.max(...this.updatedFiles.map(args[0].getSourceFile.bind(args[0])).map(this.scanner.refreshTypes.bind(this.scanner)), UpdateResult.NOTHING);
        let diagnostic = null;
        switch (result) {
          case UpdateResult.SCHEMA:
              diagnostic = "Only schema changed.";
            break;
          case UpdateResult.FULL:
            diagnostic = "Rescanning all module api files.";
            break;
        }
        if (diagnostic) {
          this.host.onWatchStatusChange?.(
            ts.createCompilerDiagnostic({
              code: -1,
              category: ts.DiagnosticCategory.Message,
              key: "",
              message: diagnostic
            }),
            this.host.getNewLine(),
            this.watch.getCurrentProgram().getCompilerOptions()
          );
        }
      } catch (e) {
        if (e instanceof ScanError) {
          console.log(`Error '${e.message}' for type '${e.typeName}' in '${e.fileName}'.`);
          return;
        } else {
          throw e;
        }
      }
      this.updatedFiles = [];

      this.invalidateModuleApiFiles(result);

      if (result === UpdateResult.NOTHING) {
        this.oldAfterProgramCreate?.(...args);
        replaceTscAliasPaths({
          configFile: this.tsconfigPath,
        });
      } else {
        this.watch.synchronizeProgram();
      }
    } else {
      this.oldAfterProgramCreate?.(...args);
      replaceTscAliasPaths({
        configFile: this.tsconfigPath,
      });
    }
  }

  protected invalidateModuleApiFiles(updateResult: UpdateResult) {
    if (updateResult === UpdateResult.NOTHING) return;

    for (const [fileName, cache] of this.watch.sourceFilesCache.entries()) {
      if (updateResult === UpdateResult.FULL) {
        if (isModuleApiFile(fileName)) {
          if (cache !== false) {
            cache.version = false;
          }
        }
      }
      if (fileName.endsWith("schema.json")) {
        if (cache !== false) {
          cache.version = false;
        }
      }
    }
  }

  protected reportDiagnostic(diagnostic: ts.Diagnostic): void {
    console.error(ts.formatDiagnostic(diagnostic, this.formatHost));
  }

  protected reportWatchStatus(diagnostic: ts.Diagnostic): void {
    fancyLog(diagnostic.messageText);
  }
}
