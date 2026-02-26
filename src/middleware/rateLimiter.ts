import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: true,
  message: { error: 'Too many requests, please try again later.' },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: true,
  keyGenerator: (req: Request & { user?: { id: string } }) => req.user?.id ?? ipKeyGenerator(req.ip ?? ''),
  message: { error: 'Too many requests, please try again later.' },
});
