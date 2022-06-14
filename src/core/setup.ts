import { walkDir, walkDirAsync } from "@core/utils";
import { __modules } from "@paths";
import * as fs from "fs";
import * as path from "path";

export default async () => {
  const modules: string[] = [];

  walkDir(__modules, (_, __, abs, isDir) => {
    if (isDir && fs.existsSync(path.join(abs, "module.yml"))) {
      modules.push(abs);
      return false;
    }
  });

  for (const module of modules) {
    if (fs.existsSync(path.join(module, "scanModules.js"))) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Need this to be synchronous
      require(path.join(module, "scanModules.js")).default(modules);
    }
    if (fs.existsSync(path.join(module, "sinks"))) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func -- `require` is marked as problematic (?)
      await walkDirAsync(path.join(module, "sinks"), async (f, __, abs) => {
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
