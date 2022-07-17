import type { Args } from "@core/rest/types";
import type { MaybePromise } from "@core/types";
import type { Request as Rq, Response as Rp } from "express";

export interface Response extends Rp { }
export interface Request extends Rq { }

type ActualAction = {
  action: "response";
  code: number;
  body?: string;
} | {
  action: "download";
  path: string;
  filename?: string;
};

/**
 * if `void`: assume response code is 200\
 * if `number`: http response code\
 * if `string`: response body and assume response code is 200
 */
export type Action =
  | void
  | number
  | string
  | {
    /**
     * @default 200
     */
    code?: number;
    /**
   * @default undefined
   */
    body?: string;
  }
  | ActualAction;

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

  get(_args: A, _res: Response, _req: Request): MaybePromise<Action> {
    return 405;
  }

  post(_args: A, _res: Response, _req: Request): MaybePromise<Action> {
    return 405;
  }

  async handle(req: Request, res: Response, args: A): Promise<void> {
    let action: Action = await this.#getHandleAction(req, res, args);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (action === undefined) action = { action: "response", code: 200 };
    else if (typeof action === "number") action = { action: "response", code: action };
    else if (typeof action === "string") action = { action: "response", code: 200, body: action };
    else if (!("action" in action)) action = { action: "response", ...action };
    const a = action as ActualAction;

    switch (a.action) {
      case "response":
        res.status(a.code).send(a.body);
        break;
      case "download":
        res.download(a.path, a.filename!);
        break;
    }
  }

  #getHandleAction(req: Request, res: Response, args: A) {
    switch (req.method) {
      case "GET":
        return this.get(args, res, req);
      case "POST":
        return this.post(args, res, req);
      default:
        return 405;
    }
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
