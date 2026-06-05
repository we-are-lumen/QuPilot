import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/error-handler';
import { authUserRouter } from './modules/auth-user/auth-user.routes';
import { authAgentRouter } from './modules/auth-agent/auth-agent.routes';
import { providersRouter } from './modules/providers/providers.routes';
import { providerQuestsRouter, publicQuestsRouter } from './modules/quests/quests.routes';
import { participationsRouter } from './modules/participations/participations.routes';
import { apiKeysRouter } from './modules/api-keys/api-keys.routes';
import { agentRouter } from './modules/agent/agent.routes';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.routes';
import { publicStatsRouter } from './modules/public-stats/public-stats.routes';

export const createApp = (): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/auth/user', authUserRouter);
  app.use('/auth/agent', authAgentRouter);
  app.use('/providers', providersRouter);
  app.use('/provider/quests', providerQuestsRouter);
  app.use(publicQuestsRouter);
  app.use(participationsRouter);
  app.use(apiKeysRouter);
  app.use(agentRouter);
  app.use(leaderboardRouter);
  app.use(publicStatsRouter);

  app.use(errorHandler);

  return app;
};
