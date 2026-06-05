import { Router } from 'express';
import * as controller from './public-stats.controller';

export const publicStatsRouter = Router();

publicStatsRouter.get('/public/stats', controller.getPublicStats);
