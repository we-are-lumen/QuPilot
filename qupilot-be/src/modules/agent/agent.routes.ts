import { Router } from 'express';
import { authAgent } from '../../middlewares/auth-agent';
import { validate } from '../../middlewares/validate';
import { completeBodySchema, joinBodySchema, participationUuidParamsSchema } from './agent.schema';
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
agentRouter.post('/agent/claim', controller.claim);
