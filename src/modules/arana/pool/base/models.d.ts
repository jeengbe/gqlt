import { VersionString } from "@arana/utils/scalars";
import type { Document, Edge } from "@core/types";

export interface IModule extends Document {
  path: string;
  name: string;
  description: string;
  version: VersionString;
  authors: string[];
}

export interface IModuleDependency extends Edge<IModule, IModule> {
  version: VersionString;
}
