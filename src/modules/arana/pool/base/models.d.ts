import type { VersionString } from "@arana/utils/scalars";
import type { Document, Edge } from "@core/types";
import type { Author } from "./scalars";

export interface IModule extends Document {
  path: string;
  zip: string;
  name: string;
  description: string;
  version: VersionString;
  authors: Author[];
}

export interface IModuleDependency extends Edge<IModule, IModule> {
  version: VersionString;
}
