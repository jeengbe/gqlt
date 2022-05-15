import { parallel } from "gulp";
import "source-map-support/register";
import { watch as watchBackend } from "./backend";
import { exec, task } from "./utils";

export const help = task(
  () => exec("gulp", ["--tasks", "--depth", "1"]),
  "List all top-level tasks"
);

// export const build = parallel(buildBackend);
export const watch = task(
  parallel(watchBackend),
  "Watch for changes to Arana"
);

export default task(help, "Run `help`");
