import { __core } from "@paths";
import * as fs from "fs";
import * as path from "path";
import type { RootType, Schema, SchemaType } from "./schema";
const schema = JSON.parse(fs.readFileSync(path.resolve(__core, "generated/schema.json"), "utf-8")) as Schema;

const filesMap: Record<string, any> = {};
const rootInstances: Record<string, any> = {};
const rootTypes: RootType[] = ["Query", "Mutation"];

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
  for (const type of rootTypes) {
    rootInstances[type] = new classes[type]();
  }
}

const classes = new Proxy({}, {
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

export const root = new Proxy({}, {
  get(_, name) {
    if (typeof name !== "string") return null;
    for (const option of rootTypes) {
      if (name in schema[option].fields) {
        return rootInstances[option][name];
      }
    }
    return null;
  }
});

export default classes;
