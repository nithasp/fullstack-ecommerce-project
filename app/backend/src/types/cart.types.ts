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
}

export interface UpsertCartItemPayload {
  productId: number;
  quantity: number;
  typeId?: string | null;
  selectedType?: Record<string, unknown> | null;
  shopId?: string | null;
  shopName?: string | null;
}
