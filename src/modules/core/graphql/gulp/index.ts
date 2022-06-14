import type { Builder } from "@gulp/backend/builder";
import { isModuleApiFile } from "@gulp/backend/utils";
import { sink } from "@gulp/sink";
import { ScanError, Scanner, UpdateResult } from "./scanner";

let scanner: Scanner;
let watch: Parameters<Sinks["afterProgramCreate"]>[0];
let updatedFiles: string[] = [];
let builder: Builder;

sink("createProgram", () => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- During the first iteration, this is not set
  if (watch) {
    for (const [fileName, cache] of watch.sourceFilesCache.entries()) {
      if (cache === false || cache.version === false) {
        // Track changed files here so we don't have to scan every file for changes
        updatedFiles.push(fileName);
      }
    }
  }
});

sink("readFile", (fileName, content) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
  if (!scanner) return;

  if (fileName.endsWith("schema.json")) {
    return JSON.stringify(scanner.getTypes(), null, 2);
  } else if (isModuleApiFile(fileName)) {
    content = scanner.replace(content);

    return `import __classes from "@classes";
${content}`;
  }
});

sink("afterProgramCreate", wa => {
  watch = wa;
  try {
    scanner = new Scanner(watch);
  } catch (e) {
    if (e instanceof ScanError) {
      console.log(`Error: ${e.message} for type '${e.typeName}' in '${e.fileName}' (field: ${e.fieldName}).`);
    }
    throw e;
  }

  // Force schema to compile by forcing complete invalidation after initial schema scan
  invalidateModuleApiFiles(UpdateResult.FULL);
  wa.synchronizeProgram();
});

sink("afterProgramRecreate", program => {
  let result;
  try {
    // Scan only files that changed since last compilation (=scan) and add ✨ custom diagnostic messages ✨
    result = Math.max(
      ...updatedFiles.map(file => scanner.refreshTypes(program.getSourceFile(file))),
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
      builder.reportWatchStatus(diagnostic);
    }
  } catch (e) {
    if (e instanceof ScanError) {
      console.log(`Error: ${e.message} for type '${e.typeName}' in '${e.fileName}' (field: ${e.fieldName}).`);
      return;
    }
    throw e;
  }
  updatedFiles = [];

  // If nothing changed since last compilation, emit
  if (result !== UpdateResult.NOTHING) {
    // Otherwise invalidate affected files and recompile
    invalidateModuleApiFiles(result);
    watch.synchronizeProgram();
    return false;
  }
});

/**
 * Invalidate affected files depending on scanner's update result
 */
function invalidateModuleApiFiles(updateResult: UpdateResult) {
  if (updateResult === UpdateResult.NOTHING) return;

  for (const [fileName, cache] of watch.sourceFilesCache.entries()) {
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

sink("setBuilder", bil => {
  builder = bil;
});
