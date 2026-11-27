import type { HealthResponse } from "@siv/contracts";
import { Router } from "express";

export function healthRouter(): Router {
  const router = Router();

  router.get("/live", (_req, res) => {
    const body: HealthResponse = { status: "ok" };
    res.json(body);
  });

  return router;
}
