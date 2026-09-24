// `Partial<T>` under exactOptionalPropertyTypes marks each property optional without allowing an
// explicit `undefined`, which is exactly what a zod `.partial()` schema produces
export type PartialUpdate<T> = { [K in keyof T]?: T[K] | undefined };
