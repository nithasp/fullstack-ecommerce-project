import app from './app';
import pool from './database';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

/** Stop accepting connections, drain in-flight requests, then close the DB pool. */
const shutdown = () => {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  // Fallback if connections refuse to drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
