import { Timestamp, VersionString } from "@arana/utils/scalars";
import __classes from "@classes";
import { Type } from "@core/utils";
import type { IModule, IModuleHistoryEntry } from "../models";

export class Module extends Type<IModule> {
  /**
   * The version history of the module
   */
  get history(): ModuleHistoryEntry[] {
    return this.data.history.map(entry => new __classes.ModuleHistoryEntry(entry));
  }
}

export class ModuleHistoryEntry extends Type<IModuleHistoryEntry> {
  /**
   * The version the history entry describes
   */
  get version(): VersionString {
    return this.data.version;
  }

  /**
   * Changes
   */
  get changelog(): string[] {
    return this.data.changelog;
  }

  /**
   * Authors of this version
   */
  get authors(): string[] {
    return this.data.authors;
  }

  /**
   * The date this version was released
   */
  get releaseDate(): Timestamp {
    return this.data.releaseDate;
  }
}
