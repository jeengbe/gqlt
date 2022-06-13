import { walkDirAsync } from "@core/utils";
import * as fs from "fs";
import * as path from "path";

export default async (modules: string[]) => {
  for (const module of modules) {
    const sinks = path.join(module, "sinks");
    if (fs.existsSync(sinks)) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func -- `require` is marked as problematic (?)
      await walkDirAsync(sinks, async (f, __, abs) => {
        if (f.endsWith(".js")) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports -- Need this to be synchronous
          const i = require(abs);
          if ("default" in i) {
            await i.default();
          }
        }
      });
    }
  }
};
