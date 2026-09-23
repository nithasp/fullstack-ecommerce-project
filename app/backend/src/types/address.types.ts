export const ADDRESS_LABELS = ['home', 'work', 'other'] as const;

export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export interface Address {
  id: number;
  userId: number;
  fullName: string;
  phone: string | null;
  address: string;
  city: string;
  label: AddressLabel;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
