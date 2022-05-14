import { Database } from "arangojs";
import { aql, AqlQuery, AqlValue } from "arangojs/aql";
import type { ArrayCursor } from "arangojs/cursor";
import type { QueryOptions } from "arangojs/database";

const db = new Database({
  url: "http://carlevel_db:8529",
  databaseName: "arana",
  auth: {
    username: "root",
    password: "jMLUSLnnrCmUcjXS8AgJnt"
  },
});

type Response<R> = Promise<ArrayCursor<R>> & {
  first(): Promise<R | undefined>;
};

export function query<R = unknown>(query: AqlQuery, options?: QueryOptions): Response<R>;
export function query<R = unknown>(query: TemplateStringsArray, ...args: AqlValue[]): Response<R>;
export function query<R = unknown>(query: AqlQuery | TemplateStringsArray, ...optionsOrArgs: QueryOptions[] | AqlValue[]): Response<R> {
  if (!("query" in query)) {
    query = aql(query, ...optionsOrArgs as AqlValue[]);
    optionsOrArgs[0] = {};
  }

  const res = db.query(query, optionsOrArgs[0] as QueryOptions) as Response<R>;
  res.first = async () => (await res).next();

  return res;
}
