import { sink } from "@core/sink";

sink("core/server/middleware", (req, res, next) => {
  console.log(req);
  next();
});
