import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './users.routes';
import productRoutes from './products.routes';
import orderRoutes from './orders.routes';
import cartRoutes from './cart.routes';
import addressRoutes from './addresses.routes';
import adminRoutes from './admin.routes';
import pageViewRoutes from './pageViews.routes';

const api = Router();

api.use('/auth',       authRoutes);
api.use('/users',      userRoutes);
api.use('/products',   productRoutes);
api.use('/orders',     orderRoutes);
api.use('/cart',       cartRoutes);
api.use('/addresses',  addressRoutes);
api.use('/admin',      adminRoutes);
api.use('/page-views', pageViewRoutes);

export default api;
