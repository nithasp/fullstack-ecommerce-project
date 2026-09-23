import { Router } from 'express';
import addressRoutes from './addresses.routes';
import adminRoutes from './admin';
import authRoutes from './auth.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './orders.routes';
import pageViewRoutes from './pageViews.routes';
import productRoutes from './products.routes';
import userRoutes from './users.routes';

const api = Router();

api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/products', productRoutes);
api.use('/orders', orderRoutes);
api.use('/cart', cartRoutes);
api.use('/addresses', addressRoutes);
api.use('/admin', adminRoutes);
api.use('/page-views', pageViewRoutes);

export default api;
