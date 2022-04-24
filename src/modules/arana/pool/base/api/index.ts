import __classes from "@classes";
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

    return data ? new __classes.Module(data) : null;
  }
}
