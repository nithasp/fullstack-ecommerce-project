export interface ProductType {
  _id?: string;
  productId?: number;
  color: string;
  quantity?: number;
  price: number;
  stock: number;
  image?: string;
}

export interface Review {
  _id?: string;
  star: number;
  comment?: string;
  userId?: string;
  userName?: string;
  date?: string;
}

export interface Product {
  id: number;
  name: string;
  price: string;
  category: string | null;
  image: string | null;
  description: string | null;
  previewImg: string[];
  types: ProductType[];
  reviews: Review[];
  overallRating: number;
  stock: number;
  isActive: boolean;
  shopId: string | null;
  shopName: string | null;
}

export interface ProductFilters {
  category?: string;
  search?: string;
  includeInactive?: boolean;
}
