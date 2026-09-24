export interface StoredRefreshToken {
  id: number;
  userId: number;
  familyId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}
