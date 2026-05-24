import type { RequestHandler } from 'express';
import { AppError } from '../../lib/errors';
import * as service from './quests.service';
import type { CreateQuestBody, ListPublicQuery } from './quests.schema';

export const create: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== 'user_provider') {
      throw new AppError(403, 'FORBIDDEN', 'Requires user_provider role');
    }
    const quest = await service.create(req.auth.sub, req.auth.wallet_address, req.body as CreateQuestBody);
    res.status(201).json({ quest });
  } catch (err) {
    next(err);
  }
};

export const listByProvider: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== 'user_provider') {
      throw new AppError(403, 'FORBIDDEN', 'Requires user_provider role');
    }
    const quests = await service.listByProvider(req.auth.sub);
    res.json({ quests });
  } catch (err) {
    next(err);
  }
};

export const getDetailForProvider: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth || req.auth.role !== 'user_provider') {
      throw new AppError(403, 'FORBIDDEN', 'Requires user_provider role');
    }
    const uuid = (req.params as { uuid: string }).uuid;
    const result = await service.getDetailForProvider(req.auth.sub, uuid);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const immutable: RequestHandler = (_req, _res, next) => {
  next(new AppError(403, 'QUEST_IMMUTABLE', 'Quest is immutable'));
};

export const listPublic: RequestHandler = async (req, res, next) => {
  try {
    const query = (req as unknown as { validatedQuery?: ListPublicQuery }).validatedQuery ?? {};
    const quests = await service.listPublic(query);
    res.json({ quests });
  } catch (err) {
    next(err);
  }
};

export const listPublicByProvider: RequestHandler = async (req, res, next) => {
  try {
    const providerUuid = (req.params as { uuid: string }).uuid;
    const quests = await service.listPublicByProvider(providerUuid);
    res.json({ quests });
  } catch (err) {
    next(err);
  }
};

export const getPublicDetail: RequestHandler = async (req, res, next) => {
  try {
    const uuid = (req.params as { uuid: string }).uuid;
    const result = await service.getPublicDetail(uuid);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
