import { PartialUpdate } from './common.types';

export interface ProductType {
  _id?: string | undefined;
  productId?: number | undefined;
  color: string;
  price: number;
  stock: number;
  image?: string | undefined;
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
  _id?: string | undefined;
  star: number;
  comment?: string | undefined;
  userId?: string | undefined;
  userName?: string | undefined;
  date?: string | undefined;
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
  category?: string | undefined;
  search?: string | undefined;
  includeInactive?: boolean | undefined;
}

export interface NewProduct {
  name: string;
  price: number;
  category?: string | null | undefined;
  image?: string | null | undefined;
  description?: string | null | undefined;
  previewImg: string[];
  types: ProductType[];
  reviews: Review[];
  overallRating: number;
  stock: number;
  isActive: boolean;
  shopId?: string | null | undefined;
  shopName?: string | null | undefined;
}

export type ProductUpdate = PartialUpdate<NewProduct>;
