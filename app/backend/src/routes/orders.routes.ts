import { Router } from 'express';
import * as orders from '../controllers/orders.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

router.use(verifyAuthToken);

router.get('/',                       orders.index);
router.get('/user/:userId/current',   orders.currentOrderByUser);
router.get('/user/:userId/completed', orders.completedOrdersByUser);
router.get('/:id/products',           orders.getOrderProducts);
router.post('/:id/products',          orders.addProduct);
router.get('/:id',                    orders.show);
router.post('/',                      orders.create);
router.put('/:id',                    orders.update);
router.delete('/:id',                 orders.destroy);

export default router;
