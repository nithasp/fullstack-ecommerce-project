import { ZodError, ZodType } from 'zod';
import { AppError } from './response';

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc ? `${acc}.${String(segment)}` : String(segment);
  }, '');
}

function firstProblem(error: ZodError): string {
  const issue = error.issues[0];
  const field = formatPath(issue.path);
  return field ? `${field} ${issue.message}` : issue.message;
}

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(firstProblem(result.error), 400, 'invalid_request');
  return result.data;
}
