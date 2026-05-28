import { Router } from 'express';
import { authAgent } from '../../middlewares/auth-agent';
import { validate } from '../../middlewares/validate';
import {
  completeBodySchema,
  joinBodySchema,
  participationUuidParamsSchema,
  syncClaimBodySchema,
} from './agent.schema';
import * as controller from './agent.controller';

export const agentRouter = Router();

agentRouter.use('/agent', authAgent);

agentRouter.post('/agent/participations', validate(joinBodySchema), controller.join);
agentRouter.post(
  '/agent/participations/:uuid/complete',
  validate(participationUuidParamsSchema, 'params'),
  validate(completeBodySchema),
  controller.complete,
);

agentRouter.get('/agent/me/stats', controller.meStats);
agentRouter.get(
  '/agent/participations/:uuid/claim-tx',
  validate(participationUuidParamsSchema, 'params'),
  controller.buildClaimTx,
);
agentRouter.post('/agent/participations/sync-claim', validate(syncClaimBodySchema), controller.syncClaim);
