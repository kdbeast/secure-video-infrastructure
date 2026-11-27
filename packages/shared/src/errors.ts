export interface AppErrorOptions {
  /** Machine-readable error code returned to clients, for example `not_found`. */
  code: string;
  /** HTTP status code used when the error reaches the API boundary. */
  status: number;
  /** When true, `message` is safe to return to clients. When false, clients receive a generic message. */
  expose?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly expose: boolean;

  constructor(message: string, options: AppErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.expose = options.expose ?? false;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
