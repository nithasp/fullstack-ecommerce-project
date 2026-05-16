export interface AddressEntry {
  id: number;
  userId?: number;
  fullName: string;
  phone?: string;
  address: string;
  city: string;
  isDefault: boolean;
  label: 'home' | 'work' | 'other';
}

export interface AddressForm {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  isDefault: boolean;
  label: 'home' | 'work' | 'other';
}

export type AddressDialogMode = 'list' | 'add' | 'edit';
