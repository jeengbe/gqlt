import * as path from "path";
import { __src } from "../paths";
import { task } from "../utils";
import { Builder } from "./builder";

export const watch = task(
  () => {
    const tsconfigPath = path.resolve(__src, "tsconfig.json");

    // eslint-disable-next-line no-new -- Meh, can't really care
    new Builder(tsconfigPath);
  },
  "Watch for changes to the backend",
  undefined,
  "watch backend"
);
