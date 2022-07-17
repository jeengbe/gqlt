import type { Args } from "@core/rest/types";
import type { MaybePromise } from "@core/types";
import type { Request as Rq, Response as Rp } from "express";

export interface Response extends Rp { }
export interface Request extends Rq { }

export type Action = {
  action: "download";
  path: string;
  filename?: string;
};

/**
 * if `void`: assume response code is 200\
 * if `number`: http response code\
 * if `string`: response body and assume response code is 200
 */
export type GetResponse = void | number | {
  /**
   * @default 200
   */
  code?: number;
  /**
   * @default undefined
   */
  body?: string;
} | string | Action;

export abstract class Handler<A> {
  /**
   * @example
   * ```ts
   * export default class extends Rest<Args<"/[...path]">> {
   *  get({ path: pathArg }: typeof this.args): GetReturn { ... }
   * }
   * ```
   * **DO NOT USE**\
   * This is only used for inferring the args type in request handlers.
   */
  declare readonly args: A;

  get(_args: A, _res: Response, _req: Request): MaybePromise<GetResponse> {
    return 405;
  }

  handle(req: Request, res: Response, args: A): MaybePromise<void> {
    res.json(args);
    return undefined;
  }
}

export const routeBlocks: {
  routes: string[];
  handler: new () => Handler<any>;
}[] = [];

export function Route<Route extends string>(route: Route | Route[]) {
  route = Array.isArray(route) ? route : [route];

  // TODO: Route validation

  return (target: new () => Handler<Args<Route>>) => {
    routeBlocks.push({
      routes: route as string[],
      handler: target
    });
  };
}
