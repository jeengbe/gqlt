import { __core } from "@paths";
import * as fs from "fs";
import * as path from "path";
import type { Sinks as SinksJson } from "../modules/core/sinks/generated/sinks";

const sinks = JSON.parse(fs.readFileSync(path.resolve(__core, "generated/sinks.json"), "utf-8")) as SinksJson;

/**
 * Get all items for a sink
 *
 * @example
 * ```ts
 * for(const item of sink("core/server/middleware")) { ... }
 * ```
 */
export function sink<S extends keyof Sinks>(name: S): Sinks[S][];
/**
 * Add an item to a sink
 *
 * @example
 * ```ts
 * sink("core/server/middleware"), (req, res, next) => { ... })
 * ```
 */
export function sink<S extends keyof Sinks>(name: S, value: Sinks[S]): void;
export function sink<S extends keyof Sinks>(name: S, value?: Sinks[S]): Sinks[S][] | void {
  return null as any;
}
