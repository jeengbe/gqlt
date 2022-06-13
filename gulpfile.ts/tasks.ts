import { parallel } from "gulp";
import { watch as watchBackend } from "./backend";
import { watch as watchGulp } from "./gulp";
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

export const gulp = task(
  parallel(watchGulp),
  "Watch for changes to gulp"
);

export default task(help, "Run `help`");
