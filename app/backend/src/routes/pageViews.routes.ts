import { Router } from 'express';
import * as pageViews from '../controllers/pageViews.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

// Any signed-in user reports the pages they open, for the admin Activity Log
router.post('/', verifyAuthToken, pageViews.record);

export default router;
