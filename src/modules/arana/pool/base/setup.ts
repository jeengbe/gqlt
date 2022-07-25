import * as fs from "fs";
import * as path from "path";
import { _modulesStore } from "./paths";


fs.writeFileSync(path.resolve(_modulesStore), "{}");
