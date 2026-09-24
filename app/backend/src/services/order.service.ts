import { Order, OrderFilters, OrderLine, OrderLineRequest, OrderStatus } from '../types/order.types';
import { Page, Pagination } from '../types/pagination.types';
import { OrderServiceDeps } from '../types/service.types';
import { AppError } from '../utils/errors';
import { pageOf } from '../utils/paging';

const notFound = (id: number) => new AppError(`order with id ${id} not found`, 404, 'not_found');

export function createOrderService({ orders, products }: OrderServiceDeps) {
  return {
    listOrders(filters: OrderFilters, page: Pagination): Promise<Page<Order>> {
      return pageOf(
        () => orders.index(filters, page),
        () => orders.count(filters),
      );
    },

    async getOrder(id: number): Promise<Order> {
      const order = await orders.show(id);
      if (!order) throw notFound(id);
      return order;
    },

    // Another customer's order is reported as not found, so its existence isn't revealed (OWASP API1)
    async getOwnOrder(id: number, userId: number): Promise<Order> {
      const order = await orders.show(id);
      if (!order || order.userId !== userId) throw notFound(id);
      return order;
    },

    getLines(orderId: number): Promise<OrderLine[]> {
      return orders.lines(orderId);
    },

    createOrder(userId: number, status: OrderStatus): Promise<Order> {
      return orders.create(userId, status);
    },

    async updateStatus(id: number, status: OrderStatus): Promise<Order> {
      const updated = await orders.updateStatus(id, status);
      if (!updated) throw notFound(id);
      return updated;
    },

    async deleteOrder(id: number): Promise<Order> {
      const deleted = await orders.delete(id);
      if (!deleted) throw notFound(id);
      return deleted;
    },

    async addLine(orderId: number, input: OrderLineRequest): Promise<OrderLine> {
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
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
