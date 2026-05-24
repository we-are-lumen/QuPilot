import { Router } from 'express';
import { authUser } from '../../middlewares/auth-user';
import { validate } from '../../middlewares/validate';
import { generateBodySchema } from './api-keys.schema';
import * as controller from './api-keys.controller';

export const apiKeysRouter = Router();

apiKeysRouter.use('/me', authUser);

apiKeysRouter.post('/me/api-key', validate(generateBodySchema), controller.generateMine);
apiKeysRouter.get('/me/api-key', controller.getMine);
apiKeysRouter.delete('/me/api-key', controller.revokeMine);
