export type ParseResult<T> =
  | { success: true; value: T; index: number }
  | { success: false; expected: string[]; index: number };
