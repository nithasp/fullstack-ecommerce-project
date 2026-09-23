import { Router } from 'express';
import * as products from '../controllers/products.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

// The catalog is read-only here and shows active products only; /admin/products manages it
router.use(verifyAuthToken);

router.get('/', products.index);
router.get('/popular', products.mostPopular);
router.get('/categories', products.categories);
router.get('/:id', products.show);

export default router;
