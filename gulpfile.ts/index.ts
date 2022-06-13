// This has to run first to reliably set cwd correctly for dotenv etc.
// ORDER MATTERS!
import * as path from "path";
import "source-map-support/register";
process.chdir(path.resolve(__dirname, ".."));

import { __gulpjs } from "@gulp/paths";
import { walkDir } from "@gulp/utils";
import * as fs from "fs";

walkDir(path.join(__gulpjs, "modules"), (_, __, abs, isDir) => {
  if (isDir && fs.existsSync(path.join(abs, "module.yml"))) {
    if (fs.existsSync(path.join(abs, "gulp", "index.js"))) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Need this to be synchronous
      require(path.join(abs, "gulp"));
    }
    return false;
  }
});

export * from "./tasks";
