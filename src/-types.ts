export type ParseResult<T> =
  | { success: true; value: T; index: number }
  | { success: false; expected: string[]; index: number };

export type Parser<T> = (input: string, index?: number) => ParseResult<T>;
