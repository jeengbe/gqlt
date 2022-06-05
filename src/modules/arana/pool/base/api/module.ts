import type { VersionString } from "@arana/utils/scalars";
import { isVersionString } from "@arana/utils/scalars";
import { query } from "@core/database";
import { Type } from "@core/graphql/type";
import { isArray, isRecordUnknown, isString } from "@core/guards";
import { DataError } from "@core/utils";
import type { IModule } from "../models";
import { isAuthor } from "../scalars";

export class Module extends Type<IModule> {
  static async formatData(data: unknown): Promise<IModule> {
    if (!isRecordUnknown(data)) throw new DataError();
    if (!isString(data.path)) throw new DataError("path");
    if (!isString(data.name)) throw new DataError("name");
    if (!isVersionString(data.version)) throw new DataError("version");
    if (!isArray(data.authors, isAuthor, 1)) throw new DataError("authors");

    return {
      _key: data.path.replace(/\//g, "_"),
      name: data.name,
      path: data.path,
      zip: "",
      description: typeof data.description === "string" ? data.description : "",
      version: data.version,
      authors: "authors" in data ? data.authors : []
    };
  }

  async save() {
    await query`
      UPSERT {
        _key: ${this.data._key}
      } INSERT ${this.data} UPDATE ${this.data} IN modules
    `;
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
   * Key of the module
   * @internal
   */
  getKey() {
    return this.data._key;
  }

  /**
   * The name of the zip file in which the modules is stored
   * @internal
   */
  getZip() {
    return this.data.zip;
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
