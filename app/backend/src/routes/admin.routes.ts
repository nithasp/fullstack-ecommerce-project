import { Router } from 'express';
import * as admin from '../controllers/admin.controller';
import { verifyAuthToken, requireAdmin } from '../middleware/auth';

const router = Router();

// One guard chain for the whole namespace: token → DB role check.
// It belongs to this router, so it can't leak onto routes registered elsewhere.
// Every request here lands in the audit log through recordActivity (app.ts), like any other route.
router.use(verifyAuthToken, requireAdmin);

router.get('/users',                admin.listUsers);
router.post('/users',               admin.createUser);
router.get('/users/:id',            admin.showUser);
router.put('/users/:id',            admin.updateUser);
router.put('/users/:id/role',       admin.updateUserRole);
router.delete('/users/:id',         admin.deleteUser);

router.get('/orders',               admin.listOrders);
router.post('/orders',              admin.createOrder);
router.get('/orders/:id',           admin.showOrder);
router.put('/orders/:id',           admin.updateOrder);
router.delete('/orders/:id',        admin.deleteOrder);
router.get('/orders/:id/products',  admin.listOrderProducts);
router.post('/orders/:id/products', admin.addOrderProduct);

router.get('/carts',                admin.listCartItems);
router.get('/carts/:userId',        admin.showUserCart);
router.post('/carts/:userId',       admin.addUserCartItem);
router.delete('/carts/:userId',     admin.clearUserCart);
router.get('/cart-items/:id',       admin.showCartItem);
router.put('/cart-items/:id',       admin.updateCartItem);
router.delete('/cart-items/:id',    admin.deleteCartItem);

router.get('/addresses',            admin.listAddresses);
router.post('/addresses',           admin.createAddress);
router.get('/addresses/:id',        admin.showAddress);
router.put('/addresses/:id',        admin.updateAddress);
router.delete('/addresses/:id',     admin.deleteAddress);

// Read-only: there is deliberately no route that edits or deletes an entry
router.get('/audit-logs',           admin.listAuditLogs);

export default router;
