export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly details: unknown;

  constructor(statusCode: number, error: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }
}

type ErrorBody = {
  statusCode?: number;
  error?: string;
  message?: string;
  details?: unknown;
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const err = (body ?? {}) as ErrorBody;
    throw new ApiError(
      err.statusCode ?? response.status,
      err.error ?? response.statusText,
      err.message ?? `Request failed with ${response.status}`,
      err.details,
    );
  }

  return body as T;
}
