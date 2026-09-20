import supertest from 'supertest';

export type TestRequest = ReturnType<typeof supertest>;

export interface TestAdmin {
  userId: number;
  username: string;
  password: string;
  token: string;
  refreshToken: string;
}

export interface TestCustomer {
  userId: number;
  username: string;
  password: string;
  token: string;
  refreshToken: string;
}
