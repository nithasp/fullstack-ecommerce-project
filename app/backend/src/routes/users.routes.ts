import { Router } from 'express';
import * as users from '../controllers/users.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

router.use(verifyAuthToken);

router.get('/:id', users.show);
router.patch('/:id', users.update);
router.put('/:id/password', users.changePassword);
router.delete('/:id', users.destroy);

export default router;
