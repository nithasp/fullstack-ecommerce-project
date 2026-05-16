import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_TEST_DB, POSTGRES_USER, POSTGRES_PASSWORD, ENV } = process.env;

const isProduction = ENV === 'production';

export default new Pool({
  host: POSTGRES_HOST,
  port: parseInt(POSTGRES_PORT as string),
  database: ENV === 'test' ? POSTGRES_TEST_DB : POSTGRES_DB,
  user: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});
