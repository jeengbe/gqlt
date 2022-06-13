import * as path from "path";
import ts from "typescript";
import { __src } from "../paths";
import { task } from "../utils";
import { Builder } from "./builder";

export const watch = task(
  () => {
    const tsconfigPath = path.resolve(__src, "tsconfig.json");
    const tsconfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, ts.sys as unknown as ts.ParseConfigFileHost)!;

    // eslint-disable-next-line no-new -- Meh, can't really care
    new Builder(tsconfigPath, tsconfig);
  },
  "Watch for changes to the backend",
  undefined,
  "watch backend"
);
