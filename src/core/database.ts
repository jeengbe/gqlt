import { Database } from "arangojs";
import type { AqlQuery } from "arangojs/aql";
import type { ArrayCursor } from "arangojs/cursor";
import type { QueryOptions } from "arangojs/database";

export const db = new Database({
  url: "http://localhost:8529",
  databaseName: "_system"
});

db.useBasicAuth("root", "3e8M@uy§'PFZ2PU_");

type Response<R> = Promise<ArrayCursor<R>> & {
  first(): Promise<R | undefined>;
};

export function query<R = unknown>(q: AqlQuery, options?: QueryOptions): Response<R> {
  const res = db.query(q, options) as Response<R>;
  res.first = async () => (await res).next();

  return res;
}
