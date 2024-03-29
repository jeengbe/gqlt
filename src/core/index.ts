// This has to run first to reliably set cwd correctly for dotenv etc.
// ORDER MATTERS!
import * as path from "path";

import "source-map-support/register";

process.chdir(path.resolve(__dirname, "..", ".."));

import "dotenv/config";

import { server } from "@core/server";
import { setup } from "@core/setup";

setup().then(server);
