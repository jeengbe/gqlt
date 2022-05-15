import { __temp } from "@paths";
import * as fs from "fs";
import * as path from "path";

export function createTempDir(): {
  name: string,
  dir: string;
  remove: () => void;
} {
  const length = 6;
  let name: string, dir: string;

  do {
    name = (Math.random() + 1).toString(16).substring(15 - length);
    dir = path.resolve(__temp, name);
  } while (fs.existsSync(dir));
  fs.mkdirSync(dir);
  return {
    name,
    dir,
    remove: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}
