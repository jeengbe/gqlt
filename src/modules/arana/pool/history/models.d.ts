import type { Timestamp, VersionString } from "@arana/utils/scalars";
import type { Document } from "@core/graphql/types";
import type { Author } from "../base/scalars";

export interface IModule extends Document {
  history: IModuleHistoryEntry[];
}

export interface IModuleHistoryEntry {
  version: VersionString;
  changelog: string[];
  authors: Author[];
  releaseDate: Timestamp;
}
