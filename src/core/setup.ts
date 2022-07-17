import { sink } from "@core/sink";
import { importAll, walkDir } from "@core/utils";
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

  // Let all modules register their sinks
  for (const module of modules) {
    await importAll(path.join(module, "sinks"), true);
  }

  for (const dir of sink("core/scanModules")) {
    for (const module of modules) {
      await importAll(path.join(module, dir));
    }
  }
};
