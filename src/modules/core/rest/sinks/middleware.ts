import type { Handler } from "@core/rest";
import { routeBlocks } from "@core/rest";
import { sink } from "@core/sink";
import { error } from "fancy-log";

type Args = Record<string, string | number | string[]>;

const routesCache: Record<string, ({ handler: Handler<any>; args: Args; }) | null> = {};

sink("core/scanModules", "rest");

sink("core/server/middleware", (req, res, next) => {
  const { path } = req;
  if (path in routesCache) {
    const hit = routesCache[path];
    if (hit !== null) {
      hit.handler.handle(req, res, hit.args);
      return;
    }
  } else {
    let found = false;

    for (const { routes, handler } of routeBlocks) {
      for (const route of routes) {
        const args = routeMatches(route, path);
        if (args) {
          if (found) error("Multiple routes match");

          // eslint-disable-next-line new-cap -- Constructed from a variable
          const handlerInstance = new handler();
          routesCache[path] = { handler: handlerInstance, args };
          handlerInstance.handle(req, res, args);

          // In dev mode, we check all handlers to see if any conflict with each other
          if (process.env.NODE_ENV === "development") {
            found = true;
            continue;
          } else {
            return;
          }
        }
      }
    }
    routesCache[path] = null;
  }

  next();
});

export function routeMatches(route: string, path: string): Args | false {
  if (route === path) return {};

  if (route.endsWith("/")) route = route.slice(0, -1);
  if (path.endsWith("/")) path = path.slice(0, -1);

  const [, ...routeParts] = route.split("/");
  const [, ...pathParts] = path.split("/");

  const args: Args = {};

  for (let i = 0; i < Math.max(pathParts.length, routeParts.length); i++) {
    let routePart = routeParts[i] as string | undefined;
    const pathPart = pathParts[i] as string | undefined;

    if (routePart === undefined) return false;

    const capture = routePart.startsWith(":");
    if (capture) routePart = routePart.slice(1);

    if (!pathPart && !routePart.startsWith("*")) return false;

    if (routePart.startsWith("*") || routePart.startsWith("+")) {
      // Variable length route

      // Evaluate remaining parts first from the back to see if rest matches
      for (let j = routeParts.length - 1; j > i; j--) {
        let routePartJ = routeParts[j] as string | undefined;
        if (!routePartJ) break;
        const pathPartJ = pathParts.at(-(routeParts.length - j));
        if (j === i) return false;

        const captureJ = routePartJ.startsWith(":");
        if (captureJ) routePartJ = routePartJ.slice(1);

        const match = doesPathPartMatchSimple(routePartJ, pathPartJ!, captureJ);
        if (match === false) return false;
        if (match === true) continue;

        if (capture) {
          // eslint-disable-next-line prefer-destructuring
          args[match[0]] = match[1];
        }
      }
      const variable: string[] = [];
      for (let j = i; j < pathParts.length - (routeParts.length - 1 - i); j++) {
        variable.push(pathParts[j]);
      }
      if (routePart.startsWith("+") && variable.length === 0) return false;
      args[routePart.slice(1)] = variable;
      return args;
    }

    const match = doesPathPartMatchSimple(routePart, pathPart!, capture);
    if (match === false) return false;
    if (match === true) continue;

    if (capture) {
      // eslint-disable-next-line prefer-destructuring
      args[match[0]] = match[1];
    }
  }

  if (routeParts.every(p => !p.startsWith(":*") && !p.startsWith(":+")) && routeParts.length !== pathParts.length) return false;

  return args;
}

function doesPathPartMatchSimple(routePart: string, pathPart: string, capture: boolean): boolean | [string, string | number] {
  const set = /(?<routePart>.*)\[(?<values>.*)\]/.exec(routePart);
  if (set) ({ routePart } = set.groups!);

  if (set) {
    if (!set.groups!.values.split("|").includes(pathPart)) return false;
  } else if (!capture && routePart !== pathPart) return false;

  if (capture) {
    if (routePart === "id" && !/^\d+$/.test(pathPart)) return false;

    return [routePart, routePart === "id" ? parseInt(pathPart, 10) : pathPart];
  }
  return true;
}
