import { Router } from 'express';
import * as orders from '../../controllers/admin/orders.controller';

const router = Router();

router.get('/', orders.index);
router.post('/', orders.create);
router.get('/:id', orders.show);
router.patch('/:id', orders.updateStatus);
router.delete('/:id', orders.destroy);
router.get('/:id/products', orders.lines);
router.post('/:id/products', orders.addLine);

export default router;
