import * as fs from "fs";
import { Schema, SchemaType } from "./schema";
const schema = JSON.parse(fs.readFileSync("generated/schema.json", "utf-8")) as Schema;

const filesMap: Record<string, any> = {};
export async function init() {
  for (const type of Object.values(schema)) {
    if (type.kind === "type") {
      for (const from of type.from) {
        if (!(from in filesMap)) {
          filesMap[from] = await import(`./../modules/${from}.js`);
        }
      }
    }
  }
}

export default new Proxy({}, {
  get(_, name) {
    if (typeof name !== "string") return null;
    if (!(name in schema)) return null;
    const type = schema[name] as SchemaType;

    return class {
      #instances;

      constructor(protected readonly data: any) {
        this.#instances = type.from.reduce((instances, from) => {
          instances[from] = new filesMap[from][type.name](data);
          return instances;
        }, {} as Record<string, any>);

        return new Proxy(this, {
          get(target, name) {
            if (typeof name !== "string") return null;
            if (name === "data") return target.data;
            if (!(name in type.fields)) return null;

            return target.#instances[type.fields[name].resolve.from][name];
          }
        });
      }
    };
  }
}) as any;
