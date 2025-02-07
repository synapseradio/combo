export type ParseResult<T> =
  | { success: true; value: T; index: number }
  | { success: false; expected: string; index: number };

// Add optional index parameter to Parser type
export type Parser<T> = (input: string, index?: number) => ParseResult<T>;
