import { query } from "@core/database";
import { aql } from "arangojs";
import type { IModule } from "../models";
import { Module } from "./module";

export class Query {
  /**
   * Get a module by its path
   * @param path The path of the module
   */
  async module(path: string): Promise<Module | null> {
    const data = await query<IModule>(aql`
      FOR module IN modules
        FILTER module.path == ${path}
        RETURN module
    `).first();

    return data ? new Module(data) : null;
  }

  /**
   * Get all modules
   */
  async modules(): Promise<Module[]> {
    const data = await query<IModule>(aql`
      FOR module IN modules
        RETURN module
    `);

    return data.map((module) => new Module(module));
  }
}

export class Mutation {
  /**
   * Create a new module
   * @param path The path of the module
   */
  createModule(path: string) {
    console.log(path)
  }
}
