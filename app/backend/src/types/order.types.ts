export interface Order {
  id?: number;
  userId: number;
  status: string;
}

export interface OrderProduct {
  id?: number;
  orderId: number;
  productId: number;
  quantity: number;
}

export interface RecentPurchase {
  productId: number;
  name: string;
  price: number;
  category: string | null;
  image: string | null;
  description: string | null;
  quantity: number;
  orderId: number;
}
