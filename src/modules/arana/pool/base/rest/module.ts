import { _modulesStore } from "@arana/pool/base/paths";
import type { Action } from "@core/rest";
import { Handler, Route } from "@core/rest";
import type { Args } from "@core/rest/types";
import * as path from "path";
import { Query } from "../api";

@Route("/modules/:+module/download")
export class Download extends Handler<Args<"/modules/:+module/download">> {
  async get({ module: modulePath }: typeof this.args): Promise<Action> {
    // 1. permission check
    // 2. module check
    // 3. pipe module zip stream
    const module = await new Query().getModule(modulePath.join("/"));
    if (!module) return 404;

    return {
      action: "download",
      path: path.resolve(_modulesStore, module.getZip()),
      filename: `${module.getName()}.zip`
    };
  }
}

@Route([
  "/jobs",
  "/jobs/:status[done|error|pending]",
  "/jobs/:id"
])
export class Jobs extends Handler<Args<[
  "/jobs",
  "/jobs/:status[done|error|pending]",
  "/jobs/:id"
]>> {
  async get(params: typeof this.args): Promise<Action> {
  }
}
