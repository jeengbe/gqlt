import { __files } from "@paths";
import * as fs from "fs";
import * as path from "path";

export const _modulesStore = path.resolve(__files, "arana", "modules");

fs.existsSync(_modulesStore) || fs.mkdirSync(_modulesStore, { recursive: true });
