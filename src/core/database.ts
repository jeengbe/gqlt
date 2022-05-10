import { Database } from "arangojs";
import type { AqlQuery } from "arangojs/aql";
import type { ArrayCursor } from "arangojs/cursor";
import type { QueryOptions } from "arangojs/database";

export const db = new Database({
  url: "http://carlevel_db:8529",
  databaseName: "carlevel"
});

db.useBasicAuth("root", "jMLUSLnnrCmUcjXS8AgJnt");

type Response<R> = Promise<ArrayCursor<R>> & {
  first(): Promise<R | undefined>;
};

export function query<R = unknown>(q: AqlQuery, options?: QueryOptions): Response<R> {
  const res = db.query(q, options) as Response<R>;
  res.first = async () => (await res).next();

  return res;
}
