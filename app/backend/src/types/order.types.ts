import { AddressLabel } from './address.types';

export const ORDER_STATUSES = ['active', 'complete'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface ShippingAddress {
  fullName: string;
  phone: string | null;
  address: string;
  city: string;
  label: AddressLabel;
}

export interface NewOrderShipping extends ShippingAddress {
  addressId: number;
}

export interface Order {
  id: number;
  userId: number;
  status: OrderStatus;
  createdAt: Date;
  total: string;
  addressId: number | null;
  shippingAddress: ShippingAddress | null;
}

export interface OrderLine {
  id: number;
  orderId: number;
  productId: number;
  variantId: number | null;
  typeId: string | null;
  quantity: number;
  unitPrice: string;
}

export interface NewOrderLine {
  productId: number;
  variantId: number | null;
  typeId: string | null;
  quantity: number;
  unitPrice: string;
}

export interface OrderLineRequest {
  productId: number;
  quantity: number;
  typeId?: string | null | undefined;
}

export interface OrderFilters {
  status?: OrderStatus | undefined;
  userId?: number | undefined;
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
