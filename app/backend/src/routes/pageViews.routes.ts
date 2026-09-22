import { Router } from 'express';
import * as pageViews from '../controllers/pageViews.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

router.post('/', verifyAuthToken, pageViews.record);

export default router;
