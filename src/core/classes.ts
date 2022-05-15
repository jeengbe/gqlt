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
          // eslint-disable-next-line require-atomic-updates -- Safe here as we only set a property
          filesMap[from] = await import(`./../modules/${from}.js`);
        }
      }
    }
  }
  for (const type of rootTypes) {
    rootInstances[type] = new classes[type]();
  }
}

const classes = new Proxy({
  _type: "_classes"
}, {
  get(_, typeName) {
    // Trap for classes
    if (typeof typeName !== "string") return null;
    if (!(typeName in schema)) return null;
    const type = schema[typeName] as SchemaType;

    return new Proxy(class {
      #instances: Record<string, any> = {};
      _type;

      constructor(
        protected readonly data: any
      ) {
        this._type = typeName;
        this.#instances = type.from.reduce<Record<string, any>>((instances, from) => {
          instances[from] = new filesMap[from][typeName](data);
          return instances;
        }, {});

        // eslint-disable-next-line no-constructor-return -- We need this here for our Proxy magic
        return new Proxy(this, {
          // Trap for instance access
          get(target, member) {
            if (typeof member !== "string") return null;
            if (member === "data") return target.data;
            if (!(member in type.fields)) return null;

            return target.#instances[type.fields[member].resolve.file][member];
          }
        });
      }
    }, {
      get(_, member) {
        // Trap for static access
        if (typeof member !== "string") return (_ as any)[member];
        if (!(member in type.staticFields)) return (_ as any)[member];

        return async (...args: any[]) => {
          const result = {};
          Object.assign(result, ...await Promise.all(type.staticFields[member].from.map(from => filesMap[from][typeName][member](...args))));
          return result;
        };
      }
    });
  }
}) as any;

export const root = new Proxy({
  _type: "_root"
}, {
  get(_, member) {
    if (typeof member !== "string") return null;
    for (const option of rootTypes) {
      if (member in schema[option].fields) {
        return rootInstances[option][member];
      }
    }
    return null;
  }
});

export default classes;
