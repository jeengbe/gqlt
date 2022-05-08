import { Database } from "arangojs";
import type { AqlQuery } from "arangojs/aql";
import type { ArrayCursor } from "arangojs/cursor";
import type { QueryOptions } from "arangojs/database";

export const db = new Database({
  url: "http://arangodb_db_container:8529",
  databaseName: "_system"
});

db.useBasicAuth("root", "ultraSecureJesperPasswort!");

type Response<R> = Promise<ArrayCursor<R>> & {
  first(): Promise<R | undefined>;
};

export function query<R = unknown>(q: AqlQuery, options?: QueryOptions): Response<R> {
  const res = db.query(q, options) as Response<R>;
  res.first = async () => (await res).next();

  return res;
}
