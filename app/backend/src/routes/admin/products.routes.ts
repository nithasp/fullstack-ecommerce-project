import { Router } from 'express';
import * as products from '../../controllers/admin/products.controller';

const router = Router();

router.get('/', products.index);
router.post('/', products.create);
router.post('/bulk', products.bulkCreate);
router.get('/:id', products.show);
router.patch('/:id', products.update);
router.delete('/:id', products.archive);

export default router;
