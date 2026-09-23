import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { NewOrderLineInput } from '../schemas/order.schema';
import { Order, OrderFilters, OrderLine, OrderStatus } from '../types/order.types';
import { Pagination } from '../types/pagination.types';
import { AppError } from '../utils/response';

const orders = new OrderRepository();
const products = new ProductRepository();

const notFound = (id: number) => new AppError(`order with id ${id} not found`, 404, 'not_found');

export async function listOrders(
  filters: OrderFilters,
  page: Pagination,
): Promise<{ items: Order[]; total: number }> {
  const [items, total] = await Promise.all([orders.index(filters, page), orders.count(filters)]);
  return { items, total };
}

export async function getOrder(id: number): Promise<Order> {
  const order = await orders.show(id);
  if (!order) throw notFound(id);
  return order;
}

// Another customer's order is reported as not found, so its existence isn't revealed (OWASP API1)
export async function getOwnOrder(id: number, userId: number): Promise<Order> {
  const order = await orders.show(id);
  if (!order || order.userId !== userId) throw notFound(id);
  return order;
}

export function getLines(orderId: number): Promise<OrderLine[]> {
  return orders.lines(orderId);
}

export function createOrder(userId: number, status: OrderStatus): Promise<Order> {
  return orders.create(userId, status);
}

export async function updateStatus(id: number, status: OrderStatus): Promise<Order> {
  const updated = await orders.updateStatus(id, status);
  if (!updated) throw notFound(id);
  return updated;
}

export async function deleteOrder(id: number): Promise<Order> {
  const deleted = await orders.delete(id);
  if (!deleted) throw notFound(id);
  return deleted;
}

export async function addLine(orderId: number, input: NewOrderLineInput): Promise<OrderLine> {
  const product = await products.show(input.productId, true);
  if (!product) throw new AppError(`product with id ${input.productId} not found`, 404, 'not_found');

  let unitPrice: string | number = product.price;
  if (input.typeId) {
    const variant = product.types.find((type) => type._id === input.typeId);
    if (!variant)
      throw new AppError(`product ${product.id} has no option ${input.typeId}`, 400, 'invalid_request');
    unitPrice = variant.price;
  }

  return orders.addLine(orderId, {
    productId: input.productId,
    typeId: input.typeId ?? null,
    quantity: input.quantity,
    unitPrice,
  });
}
