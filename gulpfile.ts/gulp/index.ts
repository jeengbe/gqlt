import { exec, task } from "../utils";

export const watch = task(
  () => exec("tsc", ["--preserveWatchOutput", "-w", "-p", "gulpfile.ts/tsconfig.json"]),
  "Watch for changes to the gulpfile",
  undefined,
  "watch gulp"
);
