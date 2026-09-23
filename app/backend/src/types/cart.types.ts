import { Order, OrderLine } from './order.types';
import { ProductType, Review } from './product.types';

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

export interface UpsertCartItem {
  productId: number;
  quantity: number;
  typeId: string | null;
}

export interface CheckoutLine {
  id: number;
  productId: number;
  typeId: string;
  quantity: number;
}

export interface CheckoutResult {
  order: Order;
  items: OrderLine[];
}
