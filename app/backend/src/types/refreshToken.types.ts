export interface StoredRefreshToken {
  id: number;
  userId: number;
  // Every token issued by rotating the same login shares a family, so a reused token can revoke the session
  familyId: string;
  expiresAt: Date;
  // Set when the token is exchanged; presenting it again after that means it was copied
  usedAt: Date | null;
  createdAt: Date;
}
