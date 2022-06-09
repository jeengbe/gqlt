import * as fs from "fs";
import * as path from "path";
import type { RootType, Schema, SchemaType } from "./generated/schema";

const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "generated/schema.json"), "utf-8")) as Schema;

const filesMap: Record<string, any> = {};
const rootInstances: Record<string, any> = {};
const rootTypes: RootType[] = ["Query", "Mutation"];

// Import all mentioned files into one map
export async function init() {
  for (const type of Object.values(schema)) {
    if (type.kind === "type") {
      for (const from of type.from) {
        if (!(from in filesMap)) {
          // eslint-disable-next-line require-atomic-updates -- Safe to use here - imports are run synchronously, therefore `from in filesMap` always yields the expected result
          filesMap[from] = await import(`./../../../modules/${from}.js`);
        }
      }
    }
  }
  // Instantiate only our root classes initially
  for (const type of rootTypes) {
    rootInstances[type] = new classes[type]();
  }
}

const classes = new Proxy({
  _type: "_classes"
}, {
  get(_, typeName) {
    // All class references are calls to this method (if proxied over __classes)
    if (typeof typeName !== "string") return null;
    if (!(typeName in schema)) return null;
    const type = schema[typeName] as SchemaType;

    // So if the type exists, return a respective class
    return new Proxy(class {
      #instances: Record<string, any> = {};
      _type;

      constructor(
        protected readonly data: any
      ) {
        this._type = typeName;
        // Instantiate all needed classes for our single proxy class for easy access later on
        this.#instances = type.from.reduce<Record<string, any>>((instances, from) => {
          instances[from] = new filesMap[from][typeName](data);
          return instances;
        }, {});

        // eslint-disable-next-line no-constructor-return -- We need this here for our Proxy magic
        return new Proxy(this, {
          // Trap instance methods and properties and use the respective instance
          get(target, member) {
            if (typeof member !== "string") return null;
            if (member === "data") return target.data;
            if (member === "save") return () => Promise.all(Object.values(target.#instances).map((i: any) => i.save()));
            if (!(member in type.fields)) return null;

            return target.#instances[type.fields[member].resolve.file][member];
          }
        });
      }
    }, {
      get(target, member) {
        // Calls to static methods and properties are trapped here
        // So call all implementations and merge their results
        if (typeof member !== "string") return (target as any)[member];
        if (!(member in type.staticFields)) return (target as any)[member];

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
    // Decide whether we operate on `Query` or `Mutation`
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
