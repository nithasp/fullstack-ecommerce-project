export interface ProductType {
  _id?: string;
  productId?: number;
  color: string;
  price: number;
  stock: number;
  image?: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  extId: string;
  color: string;
  price: number;
  stock: number;
  image: string | null;
  position: number;
}

export type VariantInput = Omit<ProductVariant, 'id' | 'productId'>;

// stock is the products column itself, not the total across options, because checkout reduces
// whichever row actually holds the stock it is spending
export interface LockedProduct {
  id: number;
  name: string;
  price: string;
  stock: number;
  isActive: boolean;
}

export interface LockedCatalog {
  products: LockedProduct[];
  variants: ProductVariant[];
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

export interface NewProduct {
  name: string;
  price: number;
  category?: string | null;
  image?: string | null;
  description?: string | null;
  previewImg: string[];
  types: ProductType[];
  reviews: Review[];
  overallRating: number;
  stock: number;
  isActive: boolean;
  shopId?: string | null;
  shopName?: string | null;
}

export type ProductUpdate = Partial<NewProduct>;
