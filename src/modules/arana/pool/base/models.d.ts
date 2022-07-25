import type { VersionString } from "@arana/utils/scalars";
import type { Document, Edge } from "@core/graphql/types";
import type { Author } from "./scalars";

export interface IModule extends Document {
  path: string;
  tarball: string;
  name: string;
  description: string;
  version: VersionString;
  authors: Author[];
}

export interface IModuleDependency extends Edge<IModule, IModule> {
  version: VersionString;
}