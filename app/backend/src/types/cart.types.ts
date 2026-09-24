import { Order, OrderLine } from './order.types';
import { ProductType, Review } from './product.types';

export const MAX_CART_QUANTITY = 999;

export interface CartItem {
  id: number;
  userId: number;
  productId: number;
  quantity: number;
  typeId: string | null;
  selectedType: ProductType | null;
  shopId: string | null;
  shopName: string | null;
  createdAt: Date;
  updatedAt: Date;
  productName: string;
  productPrice: string;
  productCategory: string | null;
  productImage: string | null;
  productDescription: string | null;
  productPreviewImg: string[];
  productTypes: ProductType[];
  productReviews: Review[];
  productOverallRating: number;
  productStock: number;
  productIsActive: boolean;
  productShopId: string | null;
  productShopName: string | null;
}

export interface AddCartItem {
  productId: number;
  quantity: number;
  typeId?: string | null | undefined;
}

export interface UpsertCartItem {
  productId: number;
  quantity: number;
  variantId: number | null;
}

export interface CartFilters {
  userId?: number | undefined;
}

export interface CheckoutLine {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
}

export interface CheckoutResult {
  order: Order;
  items: OrderLine[];
}
