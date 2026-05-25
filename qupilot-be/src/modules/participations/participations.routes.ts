import { Router } from 'express';
import { authUser } from '../../middlewares/auth-user';
import { validate } from '../../middlewares/validate';
import { participationQuestUuidParamsSchema, syncClaimBodySchema } from './participations.schema';
import * as controller from './participations.controller';

export const participationsRouter = Router();

participationsRouter.use('/me', authUser);

participationsRouter.get('/me/participations', controller.listMine);
participationsRouter.get(
  '/me/participations/:questUuid',
  validate(participationQuestUuidParamsSchema, 'params'),
  controller.getMineDetail,
);
participationsRouter.post('/me/participations/sync-claim', validate(syncClaimBodySchema), controller.syncClaimMine);
