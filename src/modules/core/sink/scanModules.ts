import { walkDirAsync } from "@core/utils";
import * as fs from "fs";
import * as path from "path";

export default async (modules: string[]) => {
  for (const module of modules) {
    const sinks = path.join(module, "sinks");
    if (fs.existsSync(sinks)) {
      await walkDirAsync(sinks, async (f, __, abs) => {
        if (f.endsWith(".js")) {
          const i = await import(abs);
          if ("default" in i) {
            await i.default();
          }
        }
      });
    }
  }
};
