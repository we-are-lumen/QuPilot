import type { RequestHandler } from 'express';
import * as service from './auth-agent.service';
import type { ChallengeBody, RegisterBody } from './auth-agent.schema';

export const challenge: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as ChallengeBody;
    const result = await service.createChallenge(body.wallet_address);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as RegisterBody;
    const result = await service.register(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

