import { Router } from 'express';
import * as carts from '../../controllers/admin/carts.controller';

export const cartRoutes = Router();

cartRoutes.get('/', carts.index);
cartRoutes.get('/:userId', carts.showUserCart);
cartRoutes.post('/:userId', carts.addUserCartItem);
cartRoutes.delete('/:userId', carts.clearUserCart);

export const cartItemRoutes = Router();

cartItemRoutes.get('/:id', carts.showItem);
cartItemRoutes.patch('/:id', carts.updateItem);
cartItemRoutes.delete('/:id', carts.removeItem);
