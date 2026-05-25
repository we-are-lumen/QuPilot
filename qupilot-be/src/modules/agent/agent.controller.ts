import type { RequestHandler } from 'express';
import { AppError } from '../../lib/errors';
import * as service from './agent.service';
import type { CompleteBody, JoinBody } from './agent.schema';

export const join: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== 'agent') {
      throw new AppError(403, 'FORBIDDEN', 'Requires agent role');
    }
    const body = req.body as JoinBody;
    const result = await service.join(req.auth.user_id, body.quest_uuid, body.agent_wallet_address);
    res.status(201).json({ participation: result });
  } catch (err) {
    next(err);
  }
};

export const complete: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== 'agent') {
      throw new AppError(403, 'FORBIDDEN', 'Requires agent role');
    }
    const uuid = (req.params as { uuid: string }).uuid;
    const result = await service.complete(req.auth.user_id, uuid, (req.body as CompleteBody).steps);
    res.json({ participation: result });
  } catch (err) {
    next(err);
  }
};
