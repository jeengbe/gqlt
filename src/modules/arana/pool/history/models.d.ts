import { Timestamp, VersionString } from "@arana/utils/scalars";
import type { IModule as IModuleBase } from "../base/models";

export interface IModule extends IModuleBase {
  history: IModuleHistoryEntry[];
}

export interface IModuleHistoryEntry {
  version: VersionString;
  changelog: string[];
  authors: string[];
  releaseDate: Timestamp;
}
