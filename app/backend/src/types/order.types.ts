export const ORDER_STATUSES = ['active', 'complete'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Order {
  id: number;
  userId: number;
  status: OrderStatus;
  createdAt: Date;
  total: string;
}

export interface OrderLine {
  id: number;
  orderId: number;
  productId: number;
  typeId: string | null;
  quantity: number;
  unitPrice: string;
}

export interface NewOrderLine {
  productId: number;
  typeId?: string | null;
  quantity: number;
  unitPrice: number | string;
}

export interface OrderFilters {
  status?: OrderStatus;
  userId?: number;
}

export interface RecentPurchase {
  productId: number;
  name: string;
  price: string;
  category: string | null;
  image: string | null;
  description: string | null;
  quantity: number;
  orderId: number;
  purchasedAt: Date;
}
