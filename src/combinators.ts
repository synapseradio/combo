import type { Parser } from '.';

// Non-recursive alternative combinator
export const alt =
  <T>(...parsers: Parser<T>[]): Parser<T> =>
  (input, index) => {
    for (const parser of parsers) {
      const result = parser(input, index);
      if (result.success) return result;
    }
    return { success: false, expected: 'any matching alternative', index };
  };

// Iterative sequence combinator
export const seq =
  <T extends any[]>(...parsers: { [K in keyof T]: Parser<T[K]> }): Parser<T> =>
  (input, index) => {
    const values: { [K in keyof T]: T[K] } = [] as any; // Assertion needed here
    let currentIndex = index;

    for (const parser of parsers) {
      const result = parser(input, currentIndex);
      if (!result.success) return { ...result, index };
      values.push(result.value);
      currentIndex = result.index;
    }

    return { success: true, value: values as T, index: currentIndex };
  };

// Mapping combinator for result transformation
export const map =
  <T, U>(parser: Parser<T>, fn: (value: T) => U): Parser<U> =>
  (input, index) => {
    const result = parser(input, index);
    return result.success ? { ...result, value: fn(result.value) } : result;
  };

export const many =
  <T>(parser: Parser<T>): Parser<T[]> =>
  (input, index) => {
    const values: T[] = [];
    let currentIndex = index;

    while (true) {
      const result = parser(input, currentIndex);
      if (!result.success) break;
      values.push(result.value);
      currentIndex = result.index;
    }

    return { success: true, value: values, index: currentIndex };
  };

export const optional = <T>(parser: Parser<T>): Parser<T | undefined> =>
  alt(parser, succeed(undefined));
