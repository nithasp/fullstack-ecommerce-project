export interface ProductType {
  _id?: string;
  productId: number;
  color: string;
  quantity: number;
  price: number;
  stock: number;
  image: string;
}

export interface Review {
  _id?: string;
  star: number;
  comment: string;
  userId: string;
  userName: string;
  date: string;
}

export interface Product {
  id?: number;
  name: string;
  category?: string;
  price: number;
  image?: string;
  description?: string;
  previewImg?: string[];
  types?: ProductType[];
  reviews?: Review[];
  overallRating?: number;
  stock?: number;
  isActive?: boolean;
  shopId?: string;
  shopName?: string;
}
