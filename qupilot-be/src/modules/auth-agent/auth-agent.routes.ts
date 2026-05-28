import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { challengeBodySchema, registerBodySchema } from './auth-agent.schema';
import * as controller from './auth-agent.controller';

export const authAgentRouter = Router();

authAgentRouter.post('/challenge', validate(challengeBodySchema), controller.challenge);
authAgentRouter.post('/register', validate(registerBodySchema), controller.register);

