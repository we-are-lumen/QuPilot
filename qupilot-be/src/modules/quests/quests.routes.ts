import { Router } from 'express';
import { authProvider } from '../../middlewares/auth-provider';
import { validate } from '../../middlewares/validate';
import { createQuestBodySchema, listPublicQuerySchema, questUuidParamsSchema } from './quests.schema';
import * as controller from './quests.controller';

export const providerQuestsRouter = Router();

providerQuestsRouter.use(authProvider);

providerQuestsRouter.post('/', validate(createQuestBodySchema), controller.create);
providerQuestsRouter.get('/', controller.listByProvider);
providerQuestsRouter.get('/:uuid', validate(questUuidParamsSchema, 'params'), controller.getDetailForProvider);
providerQuestsRouter.patch('/:uuid', validate(questUuidParamsSchema, 'params'), controller.immutable);
providerQuestsRouter.put('/:uuid', validate(questUuidParamsSchema, 'params'), controller.immutable);

export const publicQuestsRouter = Router();

publicQuestsRouter.get('/quests', validate(listPublicQuerySchema, 'query'), controller.listPublic);
publicQuestsRouter.get('/public/highlights', controller.publicHighlights);
publicQuestsRouter.get(
  '/providers/:uuid/quests',
  validate(questUuidParamsSchema, 'params'),
  controller.listPublicByProvider,
);
publicQuestsRouter.get('/quests/:uuid', validate(questUuidParamsSchema, 'params'), controller.getPublicDetail);
