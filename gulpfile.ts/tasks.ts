import { parallel } from "gulp";
import { watch as watchBackend } from "./backend";
import { task } from "./utils";

// export const build = parallel(buildBackend);
export const watch = task(
  parallel(watchBackend),
  "Watch for changes to Arana"
);
