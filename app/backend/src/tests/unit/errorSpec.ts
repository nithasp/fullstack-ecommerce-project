import { NextFunction, Request, Response } from 'express';
import { errorMiddleware, notFoundMiddleware } from '../../middleware/error';
import { CapturedError, ErrorEnvelope, PostgresErrorFields } from '../../types/test.types';
import { AppError } from '../../utils/errors';

function capture(
  run: (req: Request, res: Response, next: NextFunction) => void,
  method = 'POST',
  path = '/things',
): CapturedError {
  const captured: CapturedError = {
    statusCode: 0,
    body: { status: 0, message: '', data: null },
    logged: false,
  };

  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: ErrorEnvelope) {
      captured.body = body;
    },
  } as unknown as Response;

  const req = {
    method,
    path,
    log: {
      error: () => {
        captured.logged = true;
      },
    },
  } as unknown as Request;

  run(req, res, () => undefined);
  return captured;
}

const handle = (err: unknown): CapturedError =>
  capture((req, res, next) => errorMiddleware(err as Error, req, res, next));

const pgError = (fields: PostgresErrorFields): Error => Object.assign(new Error('postgres said no'), fields);

describe('Error middleware', () => {
  describe('unknown routes', () => {
    it('answers 404 naming the method and path', () => {
      const res = capture((req, r) => notFoundMiddleware(req, r), 'DELETE', '/nowhere');

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Route DELETE /nowhere not found');
      expect(res.body.code).toBe('not_found');
      expect(res.body.data).toBeNull();
    });
  });

  describe('application errors', () => {
    it('passes an AppError through with its status, code and message', () => {
      const res = handle(new AppError('order with id 7 not found', 404, 'not_found'));

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('order with id 7 not found');
      expect(res.body.code).toBe('not_found');
      expect(res.logged).toBe(false);
    });

    it('falls back to bad_request when an error carries no code', () => {
      const res = handle(Object.assign(new Error('not allowed'), { statusCode: 400 }));

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('bad_request');
    });

    it('reads `status` when an error has no `statusCode`', () => {
      const res = handle(Object.assign(new Error('gone'), { status: 410 }));

      expect(res.statusCode).toBe(410);
      expect(res.body.message).toBe('gone');
    });

    it('uses a fallback message when the error has none', () => {
      const res = handle(Object.assign(new Error(), { statusCode: 400 }));

      expect(res.body.message).toBe('Request failed');
    });
  });

  // An unexpected failure must never echo its message: it can carry SQL, a stack or an internal path
  describe('unexpected failures', () => {
    it('logs a bare Error and answers a generic 500', () => {
      const res = handle(new Error('connect ECONNREFUSED 10.0.0.4:5432'));

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('Internal Server Error');
      expect(res.body.code).toBe('internal_error');
      expect(res.logged).toBe(true);
    });

    it('does not leak the message of a 500 raised with a status', () => {
      const res = handle(Object.assign(new Error('relation "users" does not exist'), { statusCode: 503 }));

      expect(res.statusCode).toBe(503);
      expect(res.body.message).toBe('Internal Server Error');
      expect(res.logged).toBe(true);
    });

    it('answers a generic 500 for a Postgres code it does not map', () => {
      const res = handle(pgError({ code: '42703' }));

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('Internal Server Error');
      expect(res.logged).toBe(true);
    });
  });

  describe('body parser failures', () => {
    it('reports malformed JSON as a 400', () => {
      const res = handle(
        Object.assign(new SyntaxError('Unexpected token }'), {
          status: 400,
          type: 'entity.parse.failed',
        }),
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Request body must be valid JSON');
      expect(res.body.code).toBe('invalid_request');
    });

    it('reports an oversized body as a 413', () => {
      const res = handle(
        Object.assign(new Error('request entity too large'), {
          status: 413,
          type: 'entity.too.large',
        }),
      );

      expect(res.statusCode).toBe(413);
      expect(res.body.message).toBe('Request body is too large');
      expect(res.body.code).toBe('invalid_request');
    });
  });

  describe('Postgres unique violations (23505)', () => {
    it('names the username when that is the constraint that failed', () => {
      const res = handle(pgError({ code: '23505', constraint: 'users_username_lower_key' }));

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe('Username already exists');
      expect(res.body.code).toBe('conflict');
    });

    it('stays generic for any other unique constraint', () => {
      const res = handle(pgError({ code: '23505', constraint: 'product_variants_product_ext_unique' }));

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe('A record with that value already exists');
    });

    it('stays generic when no constraint is reported', () => {
      const res = handle(pgError({ code: '23505' }));

      expect(res.body.message).toBe('A record with that value already exists');
    });
  });

  describe('Postgres foreign key violations (23503)', () => {
    it('reports a row that is still referenced as a conflict', () => {
      const res = handle(
        pgError({
          code: '23503',
          constraint: 'order_products_product_id_fkey',
          detail: 'Key (id)=(4) is still referenced from table "order_products".',
        }),
      );

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe('This record is used elsewhere and cannot be deleted');
      expect(res.body.code).toBe('conflict');
    });

    it('names the missing entity from the constraint', () => {
      const cases: [string, string][] = [
        ['cart_items_user_id_fkey', 'User does not exist'],
        ['order_products_product_id_fkey', 'Product does not exist'],
        ['order_products_order_id_fkey', 'Order does not exist'],
        ['orders_address_id_fkey', 'Address does not exist'],
      ];

      for (const [constraint, message] of cases) {
        const res = handle(pgError({ code: '23503', constraint }));
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe(message);
        expect(res.body.code).toBe('invalid_request');
      }
    });

    it('stays generic for a constraint it cannot read an entity from', () => {
      const res = handle(pgError({ code: '23503', constraint: 'something_else_fkey' }));

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('A referenced record does not exist');
    });

    it('stays generic when no constraint is reported', () => {
      const res = handle(pgError({ code: '23503' }));

      expect(res.body.message).toBe('A referenced record does not exist');
    });
  });

  describe('other Postgres rejections', () => {
    it('maps each value error to a 400 with a fixed message', () => {
      const cases: [string, string][] = [
        ['23514', 'A value is not allowed here'],
        ['22001', 'A value is too long'],
        ['22003', 'A number is out of range'],
        ['22P02', 'A value has an invalid format'],
      ];

      for (const [code, message] of cases) {
        const res = handle(pgError({ code }));
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe(message);
        expect(res.body.code).toBe('invalid_request');
      }
    });

    it('asks the caller to retry after a serialization failure or a deadlock', () => {
      for (const code of ['40001', '40P01']) {
        const res = handle(pgError({ code }));
        expect(res.statusCode).toBe(409);
        expect(res.body.message).toBe('The request collided with another one, please try again');
        expect(res.body.code).toBe('conflict');
      }
    });

    it('never logs a rejection it answered as a 4xx', () => {
      expect(handle(pgError({ code: '23514' })).logged).toBe(false);
    });
  });
});
