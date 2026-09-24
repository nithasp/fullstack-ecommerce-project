export type PartialUpdate<T> = { [K in keyof T]?: T[K] | undefined };
