import { __temp } from "@paths";
import * as fs from "fs";
import * as path from "path";
import { randomHex } from "./utils";

export function createTempDir(): {
  name: string;
  dir: string;
  remove: () => void;
} {
  let name: string;
  let dir: string;

  do {
    name = randomHex(6);
    dir = path.resolve(__temp, name);
  } while (fs.existsSync(dir));
  fs.mkdirSync(dir);
  return {
    name,
    dir,
    remove: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}
