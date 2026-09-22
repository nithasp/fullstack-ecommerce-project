import { withTransaction } from '../database';
import { OrderRepository } from '../repositories/order.repository';
import { CartRepository } from '../repositories/cart.repository';
import { Order } from '../types/order.types';
import { CheckoutItem } from '../types/cart.types';

const orders = new OrderRepository();
const cart = new CartRepository();

export async function checkout(userId: number, items: CheckoutItem[]): Promise<Order> {
  return withTransaction(async (tx) => {
    const order = await orders.create({ userId, status: 'complete' }, tx);
    for (const item of items) {
      await orders.addProduct({ orderId: order.id as number, productId: item.productId, quantity: item.quantity }, tx);
    }
    await cart.clearByUser(userId, tx);
    return order;
  });
}
