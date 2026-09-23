import { Router } from 'express';
import * as addresses from '../controllers/addresses.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

router.use(verifyAuthToken);

router.get('/', addresses.index);
router.get('/:id', addresses.show);
router.post('/', addresses.create);
router.patch('/:id', addresses.update);
router.delete('/:id', addresses.destroy);

export default router;
