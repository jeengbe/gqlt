import { __modules } from "@paths";
import * as fs from "fs";
import * as path from "path";

export default async () => {
  const modules: string[] = [];

  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    console.log(dir, files);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      if (fs.existsSync(path.join(filePath, "module.yml"))) {
        modules.push(filePath);
      } else if (fs.statSync(filePath).isDirectory()) {
        walk(filePath);
      }
    });
  }

  walk(__modules);

  console.log(modules);
  for (const module of modules) {
    if (fs.existsSync(path.join(module, "scanModules.js"))) {
      (await import(path.join(module, "scanModules.js"))).default(modules);
    }
  }
};
