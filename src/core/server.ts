import { sink } from "@core/sink";
import { makeArray } from "@core/utils";
import cors from "cors";
import type { RequestHandler } from "express";
import express from "express";

export default () => {
  const app = express();

  app.use(cors());
  // @ts-expect-error -- No idea why this doesn't work
  sink("core/server/middleware").forEach(m => app.use(...makeArray(m)));

  app.listen(3000);
};

declare global {
  interface Sinks {
    /**
     * Either middleware or if tuple, the first element is the path, the second is the middleware
     */
    "core/server/middleware": RequestHandler | [string, RequestHandler];
  }
}
