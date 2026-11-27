import { AppError } from "@siv/shared";
import type { RequestHandler } from "express";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(
    new AppError("Route not found.", {
      code: "not_found",
      status: 404,
      expose: true,
    }),
  );
};
