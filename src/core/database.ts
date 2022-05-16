import { Database } from "arangojs";
import type { AqlQuery, AqlValue } from "arangojs/aql";
import { aql } from "arangojs/aql";
import type { ArrayCursor } from "arangojs/cursor";
import type { QueryOptions } from "arangojs/database";

const db = new Database({
  url: "http://carlevel_db:8529",
  databaseName: "arana",
  auth: {
    username: "root",
    password: "jMLUSLnnrCmUcjXS8AgJnt"
  }
});

type Response<R> = Promise<ArrayCursor<R>> & {
  first(): Promise<R | undefined>;
};

/**
 * @example
 * ```ts
 * const user = await query<IUser>`
 *  FOR user IN users
 *    FILTER user.username == ${username}
 *    RETURN user
 * `.first();
 * ```
 *
 * @example
 * ```ts
 * const user = await query<IUser>(aql`
 *  FOR user IN users
 *    FILTER user.username == ${username}
 *    RETURN user
 * `).first();
 * ```
 */
export function query<R = unknown>(q: AqlQuery, options?: QueryOptions): Response<R>;
export function query<R = unknown>(q: TemplateStringsArray, ...args: AqlValue[]): Response<R>;
export function query<R = unknown>(q: AqlQuery | TemplateStringsArray, ...optionsOrArgs: QueryOptions[] | AqlValue[]): Response<R> {
  if (!("query" in q)) {
    q = aql(q, ...optionsOrArgs as AqlValue[]);
    optionsOrArgs[0] = {};
  }

  const res = db.query(q, optionsOrArgs[0] as QueryOptions) as Response<R>;
  res.first = async () => (await res).next();

  return res;
}
