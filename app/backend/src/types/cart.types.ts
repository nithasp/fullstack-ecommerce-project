export interface CartItem {
  id?: number;
  userId: number;
  productId: number;
  quantity: number;
  typeId?: string;
  selectedType?: Record<string, unknown> | null;
  shopId?: string | null;
  shopName?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  // Joined product fields — present when fetched with a products JOIN
  productName?: string;
  productPrice?: number | string;
  productIsActive?: boolean;
}

export interface UpsertCartItemPayload {
  productId: number;
  quantity: number;
  typeId?: string | null;
  selectedType?: Record<string, unknown> | null;
  shopId?: string | null;
  shopName?: string | null;
}
