import { _modulesStore } from "@arana/pool/base/paths";
import type { GetReturn } from "@core/rest";
import { Rest } from "@core/rest";
import type { Args } from "@core/rest/types";
import * as path from "path";
import { Query } from "../../api";

export default class extends Rest<Args<"/[...module]/download">> {
  async get({ module: modulePath }: typeof this.args): Promise<GetReturn> {
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
