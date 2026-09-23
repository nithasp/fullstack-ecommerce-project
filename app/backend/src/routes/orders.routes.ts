import { Router } from 'express';
import * as orders from '../controllers/orders.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

// Customers can read their own orders; checkout is the only way one is created, and only an admin
// can change or remove one (OWASP API6)
router.use(verifyAuthToken);

router.get('/', orders.index);
router.get('/:id', orders.show);
router.get('/:id/products', orders.lines);

export default router;
