import { withTransaction } from '../database';
import { CartRepository } from '../repositories/cart.repository';
import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AddCartItemInput } from '../schemas/cart.schema';
import { CartItem, CheckoutResult } from '../types/cart.types';
import { NewOrderLine } from '../types/order.types';
import { Pagination } from '../types/pagination.types';
import { Product, ProductType } from '../types/product.types';
import { AppError } from '../utils/response';

const carts = new CartRepository();
const orders = new OrderRepository();
const products = new ProductRepository();

const itemNotFound = (id: number) => new AppError(`Cart item ${id} not found`, 404, 'not_found');

export function getCart(userId: number): Promise<CartItem[]> {
  return carts.listByUser(userId);
}

// The option, its price and the shop are read from the product, so a request cannot put its own
// price into a cart row (OWASP API3)
async function resolveProduct(input: AddCartItemInput): Promise<{
  product: Product;
  selectedType: ProductType | null;
  typeId: string | null;
}> {
  const product = await products.show(input.productId);
  if (!product) throw new AppError('Product does not exist', 400, 'invalid_request');

  const typeId = input.typeId ?? null;
  if (!typeId) return { product, selectedType: null, typeId: null };

  const selectedType = product.types.find((type) => type._id === typeId) ?? null;
  if (!selectedType) throw new AppError('That option is no longer available', 400, 'invalid_request');
  return { product, selectedType, typeId };
}

export async function addItem(userId: number, input: AddCartItemInput): Promise<CartItem> {
  const { product, selectedType, typeId } = await resolveProduct(input);
  return carts.upsert(
    userId,
    { productId: product.id, quantity: input.quantity, typeId },
    { shopId: product.shopId, shopName: product.shopName },
    selectedType,
  );
}

export async function updateQuantity(
  userId: number,
  cartItemId: number,
  quantity: number,
): Promise<CartItem> {
  const updated = await carts.updateQuantity(cartItemId, quantity, userId);
  if (!updated) throw itemNotFound(cartItemId);
  return updated;
}

export async function removeItem(userId: number, cartItemId: number): Promise<CartItem> {
  const removed = await carts.remove(cartItemId, userId);
  if (!removed) throw itemNotFound(cartItemId);
  return removed;
}

export function clearCart(userId: number): Promise<void> {
  return carts.clearByUser(userId);
}

export async function listAllCartItems(
  filters: { userId?: number },
  page: Pagination,
): Promise<{ items: CartItem[]; total: number }> {
  const [items, total] = await Promise.all([carts.listAll(filters, page), carts.count(filters)]);
  return { items, total };
}

export async function getCartItem(cartItemId: number): Promise<CartItem> {
  const item = await carts.findById(cartItemId);
  if (!item) throw itemNotFound(cartItemId);
  return item;
}

export async function updateQuantityById(cartItemId: number, quantity: number): Promise<CartItem> {
  const updated = await carts.updateQuantity(cartItemId, quantity);
  if (!updated) throw itemNotFound(cartItemId);
  return updated;
}

export async function removeById(cartItemId: number): Promise<CartItem> {
  const removed = await carts.remove(cartItemId);
  if (!removed) throw itemNotFound(cartItemId);
  return removed;
}

export async function checkout(userId: number, cartItemIds: number[]): Promise<CheckoutResult> {
  const wanted = [...new Set(cartItemIds)];

  return withTransaction(async (tx) => {
    const lines = await carts.lockForCheckout(userId, wanted, tx);
    if (lines.length !== wanted.length) {
      throw new AppError('Some of those items are no longer in your cart', 409, 'conflict');
    }

    const locked = await products.lockByIds([...new Set(lines.map((line) => line.productId))], tx);
    const stockById = new Map(
      locked.map((product) => [
        product.id,
        { product, stock: product.stock, types: product.types.map((type) => ({ ...type })) },
      ]),
    );

    const orderLines: NewOrderLine[] = [];

    for (const line of lines) {
      const entry = stockById.get(line.productId);
      if (!entry || !entry.product.isActive) {
        throw new AppError('One of those products is no longer on sale', 409, 'conflict');
      }

      const { product } = entry;
      let unitPrice: string | number = product.price;

      if (line.typeId) {
        const variant = entry.types.find((type) => type._id === line.typeId);
        if (!variant) {
          throw new AppError(`The chosen option of "${product.name}" is no longer on sale`, 409, 'conflict');
        }
        if (variant.stock < line.quantity) {
          throw new AppError(
            `Only ${variant.stock} left of "${product.name}" (${variant.color})`,
            409,
            'conflict',
          );
        }
        variant.stock -= line.quantity;
        unitPrice = variant.price;
      }

      if (entry.stock < line.quantity) {
        throw new AppError(`Only ${entry.stock} left of "${product.name}"`, 409, 'conflict');
      }
      entry.stock -= line.quantity;

      orderLines.push({
        productId: product.id,
        typeId: line.typeId || null,
        quantity: line.quantity,
        unitPrice,
      });
    }

    const order = await orders.create(userId, 'complete', tx);
    const items = await orders.addLines(order.id, orderLines, tx);

    for (const [productId, entry] of stockById) {
      await products.updateStock(productId, entry.stock, entry.types, tx);
    }
    await carts.deleteMany(wanted, tx);

    const totalCents = items.reduce(
      (sum, item) => sum + Math.round(Number(item.unitPrice) * 100) * item.quantity,
      0,
    );

    return { order: { ...order, total: (totalCents / 100).toFixed(2) }, items };
  });
}
