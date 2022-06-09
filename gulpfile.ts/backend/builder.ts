import fancyLog from "fancy-log";
import * as fs from "fs";
import * as path from "path";
import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";
import { __dist, __src } from "../paths";
import { walkDir } from "../utils";
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

    // We patch these, so we need a reference to their original
    this.oldReadFile = this.host.readFile.bind(this.host);
    this.host.readFile = this.readFile.bind(this);
    this.oldCreateProgram = this.host.createProgram.bind(this.host);
    this.host.createProgram = this.createProgram.bind(this);
    this.oldAfterProgramCreate = this.host.afterProgramCreate?.bind(this.host);
    this.host.afterProgramCreate = this.afterProgramCreate.bind(this);

    // This cast is ok as we patch TS to expose the extra variables and methods
    this.watch = ts.createWatchProgram(this.host) as any;

    try {
      this.scanner = new Scanner(this.watch);
    } catch (e) {
      if (e instanceof ScanError) {
        console.log(`Error: ${e.message} for type '${e.typeName}' in '${e.fileName}' (field: ${e.fieldName}).`);
      }
      throw e;
    }

    // Force schema to compile by forcing complete invalidation after initial schema scan
    this.invalidateModuleApiFiles(UpdateResult.FULL);
    this.watch.synchronizeProgram();
  }

  protected readFile(...args: Parameters<typeof this.oldReadFile>) {
    const [fileName] = args;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.scanner) {
      return this.oldReadFile(fileName);
    }

    if (fileName.endsWith("schema.json")) {
      return JSON.stringify(this.scanner.getTypes(), null, 2);
    } else if (isModuleApiFile(fileName)) {
      let content = this.oldReadFile(fileName);
      content = this.scanner.replace(content);

      return `import __classes from "@classes";
${content}`;
    }
    return this.oldReadFile(fileName);
  }

  protected createProgram(...args: Parameters<typeof this.oldCreateProgram>) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.watch) {
      for (const [fileName, cache] of this.watch.sourceFilesCache.entries()) {
        if (cache === false || cache.version === false) {
          // Track changed files here so we don't have to scan every file for changes
          this.updatedFiles.push(fileName);
        }
      }
    }

    return this.oldCreateProgram(...args);
  }

  protected afterProgramCreate(...args: Parameters<Exclude<typeof this.oldAfterProgramCreate, undefined>>) {
    const [program] = args;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Not unnecessary as this may be called before initialization in the constructor
    if (this.watch) {
      let result;
      try {
        // Scan only files that changed since last compilation (=scan) and add ✨ custom diagnostic messages ✨
        result = Math.max(
          ...this.updatedFiles.map(file => this.scanner.refreshTypes(program.getSourceFile(file))),
          UpdateResult.NOTHING
        );
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
          this.reportWatchStatus(diagnostic);
        }
      } catch (e) {
        if (e instanceof ScanError) {
          console.log(`Error: ${e.message} for type '${e.typeName}' in '${e.fileName}' (field: ${e.fieldName}).`);
          return;
        }
        throw e;
      }
      this.updatedFiles = [];

      // If nothing changed since last compilation, emit
      if (result === UpdateResult.NOTHING) {
        this.oldAfterProgramCreate?.(...args);
        this.afterEmit(program);
      } else {
        // Otherwise invalidate affected files and recompile
        this.invalidateModuleApiFiles(result);
        this.watch.synchronizeProgram();
      }
    } else {
      // Initial pass (not everything is initialized yet), emit normally
      this.oldAfterProgramCreate?.(...args);
      this.afterEmit(program);
    }
  }

  /**
   * Invalidate affected files depending on scanner's update result
   */
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
    console.error(ts.formatDiagnostic(diagnostic, this.formatHost));
  }

  protected reportWatchStatus(diagnostic: ts.Diagnostic | string): void {
    fancyLog(typeof diagnostic === "string" ? diagnostic : diagnostic.messageText);
  }
}
