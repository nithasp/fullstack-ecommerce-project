export interface Address {
  id?: number;
  userId: number;
  fullName: string;
  phone?: string;
  address: string;
  city: string;
  label: 'home' | 'work' | 'other';
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AddressForm {
  fullName: string;
  phone?: string;
  address: string;
  city: string;
  label: 'home' | 'work' | 'other';
  isDefault: boolean;
}
