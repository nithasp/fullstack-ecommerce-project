import { withTransaction } from '../database';
import { AddressRepository } from '../repositories/address.repository';
import { CartRepository } from '../repositories/cart.repository';
import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AddCartItem, CartItem, CheckoutResult } from '../types/cart.types';
import { NewOrderLine } from '../types/order.types';
import { Page, Pagination } from '../types/pagination.types';
import { AppError } from '../utils/errors';
import { pageOf } from '../utils/paging';

const addresses = new AddressRepository();
const carts = new CartRepository();
const orders = new OrderRepository();
const products = new ProductRepository();

const itemNotFound = (id: number) => new AppError(`Cart item ${id} not found`, 404, 'not_found');

export function getCart(userId: number): Promise<CartItem[]> {
  return carts.listByUser(userId);
}

// The option, its price and the shop are read from the product, so a request cannot put its own
// price into a cart row (OWASP API3)
export async function addItem(userId: number, input: AddCartItem): Promise<CartItem> {
  const product = await products.show(input.productId);
  if (!product) throw new AppError('Product does not exist', 400, 'invalid_request');

  let variantId: number | null = null;

  if (product.types.length) {
    const wanted = input.typeId?.trim();
    if (!wanted) throw new AppError('Please choose an option', 400, 'invalid_request');

    const variant = await products.findVariant(product.id, wanted);
    if (!variant) throw new AppError('That option is no longer available', 400, 'invalid_request');
    variantId = variant.id;
  }

  return carts.upsert(
    userId,
    { productId: product.id, quantity: input.quantity, variantId },
    { shopId: product.shopId, shopName: product.shopName },
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

export function listAllCartItems(filters: { userId?: number }, page: Pagination): Promise<Page<CartItem>> {
  return pageOf(
    () => carts.listAll(filters, page),
    () => carts.count(filters),
  );
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

const soldOut = (name: string, left: number, option?: string) =>
  new AppError(`Only ${left} left of "${name}"${option ? ` (${option})` : ''}`, 409, 'conflict');

export async function checkout(
  userId: number,
  cartItemIds: number[],
  addressId: number,
): Promise<CheckoutResult> {
  const wanted = [...new Set(cartItemIds)];

  return withTransaction(async (tx) => {
    // Looked up against the signed-in account, so an order cannot be shipped to somebody else's
    // address by sending its id (OWASP API1)
    const address = await addresses.findForUser(addressId, userId, tx);
    if (!address) throw new AppError('That shipping address was not found', 404, 'not_found');

    const lines = await carts.lockForCheckout(userId, wanted, tx);
    if (lines.length !== wanted.length) {
      throw new AppError('Some of those items are no longer in your cart', 409, 'conflict');
    }

    const productIds = [...new Set(lines.map((line) => line.productId))];
    const locked = await products.lockForCheckout(productIds, tx);
    const productById = new Map(locked.products.map((product) => [product.id, product]));
    const variantById = new Map(locked.variants.map((variant) => [variant.id, variant]));

    const orderLines: NewOrderLine[] = [];
    const fromProduct = new Map<number, number>();
    const fromVariant = new Map<number, number>();

    for (const line of lines) {
      const product = productById.get(line.productId);
      if (!product || !product.isActive) {
        throw new AppError('One of those products is no longer on sale', 409, 'conflict');
      }

      if (line.variantId === null) {
        const taken = (fromProduct.get(product.id) ?? 0) + line.quantity;
        if (product.stock < taken) throw soldOut(product.name, product.stock);
        fromProduct.set(product.id, taken);

        orderLines.push({
          productId: product.id,
          variantId: null,
          typeId: null,
          quantity: line.quantity,
          unitPrice: product.price,
        });
        continue;
      }

      const variant = variantById.get(line.variantId);
      if (!variant || variant.productId !== product.id) {
        throw new AppError(`The chosen option of "${product.name}" is no longer on sale`, 409, 'conflict');
      }

      const taken = (fromVariant.get(variant.id) ?? 0) + line.quantity;
      if (variant.stock < taken) throw soldOut(product.name, variant.stock, variant.color);
      fromVariant.set(variant.id, taken);

      orderLines.push({
        productId: product.id,
        variantId: variant.id,
        typeId: variant.extId,
        quantity: line.quantity,
        unitPrice: variant.price.toFixed(2),
      });
    }

    const order = await orders.create(
      userId,
      'complete',
      {
        addressId: address.id,
        fullName: address.fullName,
        phone: address.phone,
        address: address.address,
        city: address.city,
        label: address.label,
      },
      tx,
    );
    const items = await orders.addLines(order.id, orderLines, tx);

    for (const [productId, quantity] of fromProduct) {
      if (!(await products.takeProductStock(productId, quantity, tx))) {
        throw new AppError('One of those products just sold out', 409, 'conflict');
      }
    }
    for (const [variantId, quantity] of fromVariant) {
      if (!(await products.takeVariantStock(variantId, quantity, tx))) {
        throw new AppError('One of those options just sold out', 409, 'conflict');
      }
    }
    await carts.deleteMany(wanted, tx);

    const placed = await orders.show(order.id, tx);
    return { order: placed ?? order, items };
  });
}
