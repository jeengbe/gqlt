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
export type GetReturn = void | number | {
  /**
   * @default 200
   */
  code?: number;
  /**
   * @default undefined
   */
  body?: string;
} | string | Action;

export abstract class Rest<Args> {
  /**
   * @example
   * ```ts
   * export default class extends Rest<Args<"/[...path]">> {
   *  get({ path: pathArg }: typeof this.args): GetReturn { ... }
   * }
   * ```
   */
  // @ts-expect-error -- Somewhat of a hack for easy args inference in handlers. We never use this, hence the error.
  readonly args: Args;

  get(_args: Args, _res: Response, _req: Request): MaybePromise<GetReturn> {
    return 405;
  }
}
