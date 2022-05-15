import type { Author } from "@arana/pool/base/scalars";
import { isAuthor } from "@arana/pool/base/scalars";
import type { Timestamp, VersionString } from "@arana/utils/scalars";
import { isTimestamp, isVersionString } from "@arana/utils/scalars";
import { DataError, isArray, isRecordUnknown, isString, Type } from "@core/utils";
import type { IModule, IModuleHistoryEntry } from "../models";

function isHistoryEntry(value: unknown): value is IModuleHistoryEntry {
  return isRecordUnknown(value)
    && isVersionString(value.version)
    && isArray(value.changelog, isString)
    && isArray(value.authors, isAuthor, 1)
    && isTimestamp(value.releaseDate);
}

export class Module extends Type<IModule> {
  static async formatData(data: unknown): Promise<IModule> {
    if (!isRecordUnknown(data)) throw new DataError();
    if (!isArray(data.history, isHistoryEntry, false)) throw new DataError("history");

    return {
      history: "history" in data ? data.history : [],
    }
  }

  /**
   * The version history of the module
   */
  getHistory(): ModuleHistoryEntry[] {
    return this.data.history.map(entry => ({
      version: entry.version,
      changelog: entry.changelog,
      authors: entry.authors,
      releaseDate: entry.releaseDate
    }));
  }
}

export interface ModuleHistoryEntry {
  /**
   * The version the history entry describes
   */
  version: VersionString;

  /**
   * Changes
   */
  changelog: string[];

  /**
   * Authors of this version
   */
  authors: Author[];

  /**
   * The date this version was released
   */
  releaseDate: Timestamp;
}
