import type { RequestHandler } from 'express';
import { AppError } from '../../lib/errors';
import * as service from './participations.service';
import type { SyncClaimBody } from './participations.schema';

export const listMine: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== 'user') {
      throw new AppError(403, 'FORBIDDEN', 'Requires user role');
    }
    const participations = await service.listByUser(req.auth.sub);
    res.json({ participations });
  } catch (err) {
    next(err);
  }
};

export const getMineDetail: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== 'user') {
      throw new AppError(403, 'FORBIDDEN', 'Requires user role');
    }
    const questUuid = (req.params as { questUuid: string }).questUuid;
    const participation = await service.getDetailForUser(req.auth.sub, questUuid);
    res.json({ participation });
  } catch (err) {
    next(err);
  }
};

export const syncClaimMine: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== 'user') {
      throw new AppError(403, 'FORBIDDEN', 'Requires user role');
    }
    const result = await service.syncClaimByUserId(req.auth.sub, req.auth.wallet_address, req.body as SyncClaimBody);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
