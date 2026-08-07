import { Request, Response, Router } from 'express';
import { CartStore } from '../models/cart';
import { OrderStore, OrderItemInput } from '../models/order';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseId, requirePositiveInt } from '../utils/validate';

const cartStore = new CartStore();
const orderStore = new OrderStore();

const getCart = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await cartStore.getByUser(req.user!.userId), 'Cart fetched.');
});

const addItem = asyncHandler(async (req: Request, res: Response) => {
  const userId     = req.user!.userId;
  const productId  = requirePositiveInt(req.body.productId, 'productId');
  const quantity   = requirePositiveInt(req.body.quantity ?? 1, 'quantity');

  const item = await cartStore.upsert(userId, {
    productId,
    quantity,
    typeId:       req.body.typeId      ?? null,
    selectedType: req.body.selectedType ?? null,
    shopId:       req.body.shopId      ?? null,
    shopName:     req.body.shopName    ?? null,
  });

  sendSuccess(res, item, 'Item added to cart.', 201);
});

const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const userId     = req.user!.userId;
  const cartItemId = parseId(req.params.id, 'cart item id');
  const quantity   = requirePositiveInt(req.body.quantity, 'quantity');

  const updated = await cartStore.updateQuantity(cartItemId, userId, quantity);
  if (!updated) throw new AppError(`Cart item ${cartItemId} not found`, 404);

  sendSuccess(res, updated, 'Cart item updated.');
});

const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const userId     = req.user!.userId;
  const cartItemId = parseId(req.params.id, 'cart item id');

  const deleted = await cartStore.remove(cartItemId, userId);
  if (!deleted) throw new AppError(`Cart item ${cartItemId} not found`, 404);

  sendSuccess(res, deleted, 'Cart item removed.');
});

const clearCart = asyncHandler(async (req: Request, res: Response) => {
  await cartStore.clearByUser(req.user!.userId);
  sendSuccess(res, null, 'Cart cleared.');
});

const checkout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const items: OrderItemInput[] = req.body.items;

  if (!Array.isArray(items) || items.length === 0)
    throw new AppError('items must be a non-empty array', 400);

  for (const item of items) {
    requirePositiveInt(item.productId, 'productId');
    requirePositiveInt(item.quantity, 'quantity');
  }

  const order = await orderStore.checkoutCart(userId, items);
  sendSuccess(res, { order: { id: order.id, userId: order.userId, status: order.status } }, 'Checkout successful.', 201);
});

const cartRouter = Router();
cartRouter.use(verifyAuthToken);

cartRouter.get('/', getCart);
cartRouter.post('/', addItem);
cartRouter.post('/checkout', checkout);
cartRouter.put('/:id', updateItem);
cartRouter.delete('/:id', removeItem);
cartRouter.delete('/', clearCart);

export default cartRouter;
