import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { Order, OrderFilters, OrderLine, OrderLineRequest, OrderStatus } from '../types/order.types';
import { Page, Pagination } from '../types/pagination.types';
import { AppError } from '../utils/errors';
import { pageOf } from '../utils/paging';

const orders = new OrderRepository();
const products = new ProductRepository();

const notFound = (id: number) => new AppError(`order with id ${id} not found`, 404, 'not_found');

export function listOrders(filters: OrderFilters, page: Pagination): Promise<Page<Order>> {
  return pageOf(
    () => orders.index(filters, page),
    () => orders.count(filters),
  );
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

export async function addLine(orderId: number, input: OrderLineRequest): Promise<OrderLine> {
  const product = await products.show(input.productId, true);
  if (!product) throw new AppError(`product with id ${input.productId} not found`, 404, 'not_found');

  if (!input.typeId) {
    return orders.addLine(orderId, {
      productId: product.id,
      variantId: null,
      typeId: null,
      quantity: input.quantity,
      unitPrice: product.price,
    });
  }

  const variant = await products.findVariant(product.id, input.typeId);
  if (!variant) {
    throw new AppError(`product ${product.id} has no option ${input.typeId}`, 400, 'invalid_request');
  }

  return orders.addLine(orderId, {
    productId: product.id,
    variantId: variant.id,
    typeId: variant.extId,
    quantity: input.quantity,
    unitPrice: variant.price.toFixed(2),
  });
}
