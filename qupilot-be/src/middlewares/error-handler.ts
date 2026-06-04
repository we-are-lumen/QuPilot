import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        issues: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  // Supabase/PostgREST errors are often plain objects (not instanceof Error),
  // which would otherwise get collapsed into a generic INTERNAL_ERROR.
  // Surface the error `code` + `message` so agents can recover (retry, fix params).
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    const code = typeof (err as any).code === 'string' ? (err as any).code : 'INTERNAL_ERROR';
    const message = (err as any).message as string;
    console.error('[unhandled object error]', err);
    res.status(500).json({ error: { code, message } });
    return;
  }

  console.error('[unhandled error]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
};
