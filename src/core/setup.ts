import { walkDir } from "@core/utils";
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
      await (await import(path.join(module, "scanModules.js"))).default(modules);
    }
  }
};
