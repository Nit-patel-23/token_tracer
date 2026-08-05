import { NextResponse } from 'next/server';

/** Consistent JSON success response. */
export function jsonOk<T extends Record<string, unknown>>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: init?.headers });
}

/** Consistent JSON error response — never leak raw DB/internal messages in production. */
export function jsonError(status: number, error: string, details?: unknown) {
  const body: Record<string, unknown> = { ok: false, error };
  if (details != null && process.env.NODE_ENV !== 'production') {
    body.details = details instanceof Error ? details.message : details;
  }
  return NextResponse.json(body, { status });
}

export function unauthorized(message = 'Unauthorized') {
  return jsonError(401, message);
}

export function forbidden(message = 'Forbidden') {
  return jsonError(403, message);
}

export function badRequest(message: string) {
  return jsonError(400, message);
}

export function notFound(message = 'Not found') {
  return jsonError(404, message);
}

export function serverError(err: unknown, fallback = 'Internal server error') {
  console.error(err);
  return jsonError(500, fallback, err);
}
