import { AddressRepository } from '../repositories/address.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { CartRepository } from '../repositories/cart.repository';
import { OrderRepository } from '../repositories/order.repository';
import { PageViewRepository } from '../repositories/pageView.repository';
import { ProductRepository } from '../repositories/product.repository';
import { RefreshTokenRepository } from '../repositories/refreshToken.repository';
import { UserRepository } from '../repositories/user.repository';
import { NewAuditLog } from './auditLog.types';
import { TokenPair } from './auth.types';
import { PublicUser } from './user.types';

export interface EventRecorder {
  recordEvent(entry: NewAuditLog): void;
}

export interface SessionIssuer {
  issueSession(user: PublicUser): Promise<TokenPair>;
  revokeAllSessions(userId: number): Promise<void>;
}

export interface AddressServiceDeps {
  addresses: Pick<
    AddressRepository,
    | 'listByUser'
    | 'listAll'
    | 'count'
    | 'findById'
    | 'findForUser'
    | 'countForUser'
    | 'create'
    | 'update'
    | 'clearDefault'
    | 'makeOldestDefault'
    | 'delete'
  >;
}

export interface AuditServiceDeps {
  auditLogs: Pick<AuditLogRepository, 'create' | 'index' | 'count' | 'deleteOlderThan'>;
}

export interface PageViewServiceDeps {
  pageViews: Pick<PageViewRepository, 'create' | 'index' | 'count' | 'deleteOlderThan'>;
}

export interface ProductServiceDeps {
  products: Pick<
    ProductRepository,
    'index' | 'count' | 'show' | 'categories' | 'mostPopular' | 'create' | 'createMany' | 'update' | 'archive'
  >;
}

export interface OrderServiceDeps {
  orders: Pick<
    OrderRepository,
    'index' | 'count' | 'show' | 'lines' | 'create' | 'updateStatus' | 'delete' | 'addLine'
  >;
  products: Pick<ProductRepository, 'show' | 'findVariant'>;
}

export interface CartServiceDeps {
  addresses: Pick<AddressRepository, 'findForUser'>;
  carts: Pick<
    CartRepository,
    | 'listByUser'
    | 'listAll'
    | 'count'
    | 'findById'
    | 'upsert'
    | 'updateQuantity'
    | 'remove'
    | 'clearByUser'
    | 'lockForCheckout'
    | 'deleteMany'
  >;
  orders: Pick<OrderRepository, 'create' | 'addLines' | 'show'>;
  products: Pick<
    ProductRepository,
    'show' | 'findVariant' | 'lockForCheckout' | 'takeProductStock' | 'takeVariantStock'
  >;
}

export interface TokenServiceDeps {
  refreshTokens: Pick<
    RefreshTokenRepository,
    | 'create'
    | 'consume'
    | 'findUsed'
    | 'deleteFamily'
    | 'deleteFamilyOf'
    | 'deleteAllForUser'
    | 'deleteExpired'
  >;
  users: Pick<UserRepository, 'show'>;
  audit: EventRecorder;
}

export interface UserServiceDeps {
  users: Pick<
    UserRepository,
    | 'index'
    | 'count'
    | 'show'
    | 'findByUsername'
    | 'findCredentials'
    | 'findCredentialsById'
    | 'create'
    | 'updateProfile'
    | 'updatePassword'
    | 'updateRole'
    | 'anonymise'
  >;
  orders: Pick<OrderRepository, 'recentPurchases'>;
  addresses: Pick<AddressRepository, 'deleteByUser'>;
  carts: Pick<CartRepository, 'clearByUser'>;
  tokens: SessionIssuer;
}
