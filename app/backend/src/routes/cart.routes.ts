import { Router } from 'express';
import * as cart from '../controllers/cart.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

router.use(verifyAuthToken);

router.get('/',          cart.getCart);
router.post('/',         cart.addItem);
router.post('/checkout', cart.checkout);
router.put('/:id',       cart.updateItem);
router.delete('/:id',    cart.removeItem);
router.delete('/',       cart.clearCart);

export default router;
