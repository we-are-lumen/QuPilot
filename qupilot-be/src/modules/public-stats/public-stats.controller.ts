import type { RequestHandler } from 'express';
import * as service from './public-stats.service';

export const getPublicStats: RequestHandler = async (_req, res, next) => {
  try {
    const stats = await service.getPublicStats();
    res.json({ stats });
  } catch (err) {
    next(err);
  }
};
