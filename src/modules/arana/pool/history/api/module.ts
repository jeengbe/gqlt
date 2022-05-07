import { Timestamp, VersionString } from "@arana/utils/scalars";
import { Type } from "@core/utils";
import type { IModule } from "../models";

export interface ModuleHistoryEntry {
  /**
   * The version the history entry describes
   */
  get version(): VersionString;

  /**
   * Changes
   */
  get changelog(): string[];

  /**
   * Authors of this version
   */
  get authors(): string[];

  /**
   * The date this version was released
   */
  get releaseDate(): Timestamp;
}

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
