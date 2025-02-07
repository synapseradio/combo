// Core types
export type ParserResult<T> = 
  | { success: true; value: T; index: number }
  | { success: false; expected: string; index: number };

export type Parser<T> = (input: string, index: number) => ParserResult<T>;

// Base parsers
export const char = (c: string): Parser<string> => 
  (input, index) => input[index] === c 
    ? { success: true, value: c, index: index + 1 } 
    : { success: false, expected: `'${c}'`, index };

export const string = (s: string): Parser<string> => 
  (input, index) => input.startsWith(s, index) 
    ? { success: true, value: s, index: index + s.length } 
    : { success: false, expected: `'${s}'`, index };

export const succeed = <T>(value: T): Parser<T> => 
  (_, index) => ({ success: true, value, index });

export const fail = <T>(expected: string): Parser<T> => 
  (_, index) => ({ success: false, expected, index });
