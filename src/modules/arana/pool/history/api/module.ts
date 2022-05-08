import { Timestamp, VersionString } from "@arana/utils/scalars";
import { Type } from "@core/utils";
import type { IModule } from "../models";

export class Module extends Type<IModule> {
  /**
   * The version history of the module
   */
  get history(): ModuleHistoryEntry[] {
    return this.data.history.map(entry => ({
      version: entry.version,
      changelog: entry.changelog,
      authors: entry.authors,
      releaseDate: entry.releaseDate,
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
  authors: string[];

  /**
   * The date this version was released
   */
  releaseDate: Timestamp;
}
