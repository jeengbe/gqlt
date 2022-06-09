import { sink } from "@core/sink";
import cors from "cors";
import express from "express";

export default async () => {
  const app = express();

  app.use(cors());
  app.use(sink("core/server/middleware"));

  app.listen(4000);
};
