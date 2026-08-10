/**
 * Any structured context an error carries travels in `details`, which every error response
 * documents, so clients get one predictable envelope for every failure.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly details: unknown;

  constructor(statusCode: number, error: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }

  toPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      statusCode: this.statusCode,
      error: this.error,
      message: this.message,
    };
    if (this.details !== undefined) payload.details = this.details;
    return payload;
  }
}

export function notFound(resource: string, id: string): HttpError {
  return new HttpError(404, 'Not Found', `${resource} '${id}' was not found`);
}

export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, 'Bad Request', message, details);
}

export function conflict(message: string, details?: unknown): HttpError {
  return new HttpError(409, 'Conflict', message, details);
}
