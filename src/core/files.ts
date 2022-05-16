import { __temp } from "@paths";
import * as fs from "fs";
import * as path from "path";
import { randomHex } from "./utils";

interface Tempdir {
  /**
   * Directory name
   */
  name: string;
  /**
   * Absolute path of the directory
   */
  dir: string;
  /**
   * Delete the temp directory
   */
  remove: () => void;
}

/**
 * Create a temporary directory
 */
export function createTempDir(): Tempdir {
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
