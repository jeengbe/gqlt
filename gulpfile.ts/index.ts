import * as path from "path";
import "source-map-support/register";
process.chdir(path.resolve(__dirname, ".."));

import "dotenv/config";

import { __gulpjs } from "@gulp/paths";
import { exec, task, walkDir } from "@gulp/utils";
import * as fs from "fs";

walkDir(path.join(__gulpjs, "modules"), (_, __, abs, isDir) => {
  if (isDir && fs.existsSync(path.join(abs, "gulp", "index.js"))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Need this to be synchronous
    require(path.join(abs, "gulp"));
    return false;
  }
});

export const help = task(() => exec("gulp", ["--tasks", "--depth", "1"]), "List all top-level tasks");
export default help;

export * from "./tasks";
