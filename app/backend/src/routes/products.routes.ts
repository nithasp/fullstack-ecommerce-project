import { Router } from 'express';
import * as products from '../controllers/products.controller';
import { verifyAuthToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Catalog reads are open to any signed-in user; catalog writes are an admin function (OWASP API5)
router.use(verifyAuthToken);

// Fixed paths before /:id, which would otherwise swallow "popular" and "categories" as an id
router.get('/',           products.index);
router.get('/popular',    products.mostPopular);
router.get('/categories', products.categories);
router.get('/:id',        products.show);
router.post('/',          requireAdmin, products.create);
router.post('/bulk',      requireAdmin, products.bulkCreate);
router.put('/:id',        requireAdmin, products.update);
router.delete('/:id',     requireAdmin, products.destroy);

export default router;
