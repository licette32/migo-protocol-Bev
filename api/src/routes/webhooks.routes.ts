import { Router } from 'express';
import { handlePomeloWebhook } from '../controllers/webhooks.controller';

const webhooksRouter = Router();

webhooksRouter.post('/:splitId', handlePomeloWebhook);

export default webhooksRouter;
