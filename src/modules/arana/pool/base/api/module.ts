import type { VersionString } from "@arana/utils/scalars";
import { query } from "@core/database";
import { Type } from "@core/utils";
import { aql } from "arangojs";
import type { IModule } from "../models";

export class Module extends Type<IModule> {
  /**
   * The path of the module
   */
  get path(): string {
    return this.data.path;
  }

  /**
   * The name of the module
   */
  get name(): string {
    return this.data.name;
  }

  /**
   * The version of the module
   */
  get version(): VersionString {
    return this.data.version;
  }

  /**
   * The description of the module
   */
  get description(): string {
    return this.data.description;
  }

  /**
   * The dependencies of the module
   */
  async dependencies(): Promise<ModuleDependency[]> {
    const cursor = await query<{
      dependency: IModule;
      version: VersionString;
    }>(aql`
      FOR dependency, edge IN 1..1 OUTBOUND ${this.data._id} dependencies
        RETURN {
          dependency,
          version: edge.version
        }
    `);
    return (await cursor.all()).map(
      ({ dependency, version }) => new ModuleDependency({ module: this, dependency, version })
    );
  }
}

export class ModuleDependency extends Type<{
  module: Module;
  dependency: IModule;
  version: VersionString;
}> {
  /**
   * The required module
   */
  get module(): Module {
    return new Module(this.data.dependency);
  }

  /**
   * The minimum required version of the module
   */
  get version(): VersionString {
    return this.data.version;
  }
}
