import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { verifyAuthToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

// Endpoints that accept credentials or tokens get the tight auth rate limit
router.post('/register',   authLimiter, auth.register);
router.post('/login',      authLimiter, auth.login);
router.post('/refresh',    authLimiter, auth.refresh);
router.post('/logout',     auth.logout);
router.post('/logout-all', verifyAuthToken, auth.logoutAll);
router.get('/me',          verifyAuthToken, auth.me);

export default router;
