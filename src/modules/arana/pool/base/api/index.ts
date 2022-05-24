import { query } from "@core/database";
import { createTempDir } from "@core/files";
import { DataError, exec, randomHex, ValidationError } from "@core/utils";
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
    // This is an important check since `git clone` allows for file paths and possible remote file access
    if (!["ssh", "https"].includes(gitUrlParse(url).protocol)) throw new ValidationError("Not ssh or https protocol");
    const { dir, remove } = createTempDir();

    try {
      await new Promise<void>((resolve, reject) => {
        // git clone the module into a new temp dir
        const git = exec("git", ["clone", url, dir], { stdio: "ignore" });
        git.on("close", async (code) => {
          // Clone failed
          if (code !== 0) reject("Invalid url");

          // Parse and check module config
          let config;
          try {
            if (!fs.existsSync(path.resolve(dir, "module.yml"))) throw new Error();
            config = parseYaml(fs.readFileSync(path.resolve(dir, "module.yml"), "utf-8")) as Record<string, unknown> | null;
            if (!(typeof config === "object" && config && "path" in config && typeof config.path === "string")) throw new Error();
            config = await Module.formatData(config);
          } catch (e) {
            if (e instanceof DataError) {
              reject(`Invalid config: ${e.message}`);
              return;
            }
            throw e;
          }

          if (await this.getModule(config.path)) {
            reject("Module already exists");
            return;
          }

          // Place the module into a zipfile for later use
          let filename;
          do {
            filename = `${randomHex(12)}.zip`;
          } while (fs.existsSync(path.resolve(_modulesStore, filename)));

          fs.rmSync(path.resolve(dir, ".git"), { recursive: true, force: true });
          const dest = fs.createWriteStream(path.resolve(_modulesStore, filename));
          const archive = createArchive("zip");
          archive.pipe(dest);
          archive.directory(dir, false);
          await archive.finalize();
          config.zip = filename;

          // Create the Module and save it
          let module;
          try {
            module = new Module(config);
            await module.save();
          } catch (e) {
            if (e instanceof DataError) {
              reject(`Invalid config value: ${e.message}`);
              fs.rmSync(path.resolve(_modulesStore, filename));
              return;
            }
            throw e;
          }

          resolve();
        });
      });
    } catch (message) {
      throw new ValidationError(message as string);
    } finally {
      remove();
    }
  }

  /**
   * Delete a module
   * @param modulePath Path of the module
   */
  async deleteModule(modulePath: string) {
    const module = await this.getModule(modulePath);
    if (!module) throw new ValidationError("Module not found");

    await query`
      REMOVE { _key: ${module.getKey()} } IN modules
    `;

    fs.rmSync(path.resolve(_modulesStore, module.getZip()));
  }
}
