import { isVersionString, VersionString } from "@arana/utils/scalars";
import { query } from "@core/database";
import { ConstructorData, DataError, isString, Type } from "@core/utils";
import type { IModule } from "../models";

export class Module extends Type<IModule> {
  constructor(data: ConstructorData<IModule>) {
    if (!isString(data.path)) throw new DataError("path");
    if (!isString(data.name)) throw new DataError("name");
    if (!isVersionString(data.version)) throw new DataError("version");
    if (Array.isArray(data.authors) && !data.authors.every(isString)) throw new DataError("authors");

    super({
      _key: data.path,
      name: data.name,
    path: data.path,
      description: typeof data.description === "string" ? data.description : "",
      version: data.version,
      authors: Array.isArray(data.authors) ? data.authors : [],
    });
  }

  /**
   * The path of the module
   */
  getPath(): string {
    return this.data.path;
  }

  /**
   * The name of the module
   */
  getName(): string {
    return this.data.name;
  }

  /**
   * The version of the module
   */
  getVersion(): VersionString {
    return this.data.version;
  }

  /**
   * The description of the module
   */
  getDescription(): string {
    return this.data.description;
  }

  /**
   * The dependencies of the module
   */
  async getDependencies(): Promise<ModuleDependency[]> {
    const cursor = await query<{
      dependency: IModule;
      version: VersionString;
    }>`
      FOR dependency, edge IN 1..1 OUTBOUND ${this.data._id} dependencies
        RETURN {
          dependency,
          version: edge.version
        }
    `;

    return (await cursor.all()).map(
      ({ dependency, version }) => ({
        module: new Module(dependency),
        version
      })
    );
  }
}

export interface ModuleDependency {
  /**
   * The required module
   */
  module: Module;

  /**
   * The minimum required version of the module
   */
  version: VersionString;
}
