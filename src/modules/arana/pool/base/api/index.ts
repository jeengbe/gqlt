import { query } from "@core/database";
import { createTempDir } from "@core/files";
import { DataError, exec, ValidationError } from "@core/utils";
import { create as createArchive } from "archiver";
import * as fs from "fs";
import gitUrlParse from "git-url-parse";
import * as os from "os";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import type { IModule } from "../models";
import { _modulesStore } from "../paths";
import { Module } from "./module";

export class Query {
  /**
   * Get a module by its path
   * @param modulePath The path of the module
   */
  async getModule(modulePath: string): Promise<Module | null> {
    const data = await query<IModule>`
      FOR module IN modules
        FILTER module.path == ${modulePath}
        RETURN module
    `.first();

    return data ? new Module(data) : null;
  }

  /**
   * Get all modules
   */
  async getModules(): Promise<Module[]> {
    const data = await query<IModule>`
      FOR module IN modules
        RETURN module
    `;

    return data.map(module => new Module(module));
  }

  /**
   * Get the server's public SSH key (for granting access to private module repositories)
   */
  get publicKey() {
    return fs.readFileSync(path.resolve(os.homedir(), ".ssh/id_rsa.pub")).toString().trimEnd();
  }

  /**
   * Add a module to the repository from a given url
   * @param url Url of the module's git repository
   */
  async addModule(url: string) {
    if (gitUrlParse(url).protocol !== "ssh") throw new ValidationError("Not ssh protocol");
    const { dir, remove } = createTempDir();

    try {
      await new Promise<void>((resolve, reject) => {
        const git = exec("git", ["clone", url, dir], { stdio: "ignore" });
        git.on("close", async (code) => {
          if (code !== 0) reject("Invalid url");

          let config;
          try {
            if (!fs.existsSync(path.resolve(dir, "module.yml"))) throw new Error();
            config = parseYaml(fs.readFileSync(path.resolve(dir, "module.yml"), "utf-8")) as Record<string, unknown> | null;
            if (!(typeof config === "object" && config && "path" in config && typeof config.path === "string")) throw new Error();
          } catch (e) {
            reject("Invalid config");
            return;
          }

          if (await this.getModule(config.path)) reject("Module already exists");

          let filename;
          do {
            filename = `${(Math.random() + 1).toString(16).substring(3)}.zip`;
          } while (fs.existsSync(path.resolve(_modulesStore, filename)));

          const dest = fs.createWriteStream(path.resolve(_modulesStore, filename));
          const archive = createArchive("zip");
          archive.pipe(dest);
          archive.directory(dir, false);
          await archive.finalize();

          let module;
          try {
            module = new Module(config);
          } catch (e) {
            if (e instanceof DataError) {
              reject(`Invalid config value: ${e.message}`);
              return;
            }
            throw e;
          }

          console.log(module);

          resolve();
        });
        git.on("", error => {
          console.log("me error");
          throw error;
        });
      });
    } catch (message) {
      throw new ValidationError(message as string);
    } finally {
      remove();
    }
  }
}
