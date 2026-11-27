import type { ErrorResponse } from "@siv/contracts";
import { AppError, isAppError, type Logger } from "@siv/shared";
import type { ErrorRequestHandler } from "express";

const GENERIC_MESSAGE = "An unexpected error occurred.";

interface ClientError {
  code: string;
  message: string;
}

const BAD_REQUEST: ClientError = {
  code: "bad_request",
  message: "The request could not be processed.",
};
const UNSUPPORTED_MEDIA_TYPE: ClientError = {
  code: "unsupported_media_type",
  message: "The request body encoding or charset is not supported.",
};

/**
 * Client-error types raised by Express body parsing (body-parser / raw-body).
 * Only these are treated as client errors; any other error is internal, whatever `status` it carries.
 */
const BODY_PARSER_ERRORS = new Map<string, ClientError>([
  ["entity.parse.failed", BAD_REQUEST],
  ["request.aborted", BAD_REQUEST],
  ["request.size.invalid", BAD_REQUEST],
  [
    "entity.too.large",
    { code: "payload_too_large", message: "Request body is too large." },
  ],
  ["charset.unsupported", UNSUPPORTED_MEDIA_TYPE],
  ["encoding.unsupported", UNSUPPORTED_MEDIA_TYPE],
]);

function fromBodyParserError(error: unknown): AppError | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("type" in error) ||
    typeof error.type !== "string" ||
    !("status" in error) ||
    typeof error.status !== "number" ||
    error.status < 400 ||
    error.status > 499
  ) {
    return undefined;
  }

  const clientError = BODY_PARSER_ERRORS.get(error.type);
  if (!clientError) return undefined;

  return new AppError(clientError.message, {
    code: clientError.code,
    status: error.status,
    expose: true,
    cause: error,
  });
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  const bodyParserError = fromBodyParserError(error);
  if (bodyParserError) return bodyParserError;

  return new AppError(GENERIC_MESSAGE, {
    code: "internal_error",
    status: 500,
    expose: false,
    cause: error,
  });
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const appError = toAppError(error);
    if (appError.status >= 500) {
      logger.error({ err: error }, "request failed");
    }

    const body: ErrorResponse = {
      error: {
        code: appError.code,
        message: appError.expose ? appError.message : GENERIC_MESSAGE,
      },
    };
    res.status(appError.status).json(body);
  };
}
