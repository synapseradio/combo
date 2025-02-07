import type { Parser } from './-types';

/**
 * Matches a single specific character. Basic building block for token recognition.
 * @example
 * const parseA = char('apple', 0); // => { success: true, value: 'a', index: 1 }
 */
export const char =
  (c: string): Parser<string> =>
  (input, index = 0) =>
    input[index] === c
      ? { success: true, value: c, index: index + 1 }
      : { success: false, expected: [`'${c}'`], index };

/**
 * Matches an exact string sequence. Essential for keyword recognition.
 * @example
 * const parseHello = string('hello');
 * parseHello('hello world', 0) // => { success: true, value: 'hello', index: 5 }
 */
export const string =
  (s: string): Parser<string> =>
  (input, index = 0) =>
    input.startsWith(s, index)
      ? { success: true, value: s, index: index + s.length }
      : { success: false, expected: [`'${s}'`], index };

/**
 * Always succeeds with provided value, consumes no input. Useful for default values.
 * @example
 * const answer = succeed(42);
 * answer('any input', 0) // => { success: true, value: 42, index: 0 }
 */
export const succeed =
  <T>(value: T): Parser<T> =>
  (_, index = 0) => ({ success: true, value, index });

/**
 * Always fails with specified expectation. Used for expected error reporting.
 * @example
 * const failNum = fail<number>('number');
 * failNum('abc', 0) // => { success: false, expected: 'number', index: 0 }
 */
export const fail =
  <T>(expected: string): Parser<T> =>
  (_, index = 0) => ({ success: false, expected: [expected], index });

/**
 * Tries multiple parsers in order, returning first success. Enables alternative patterns.
 * @example
 * const aOrB = alt(char('a'), char('b'));
 * aOrB('banana', 0) // => { success: true, value: 'b', index: 1 }
 */
export const alt =
  <T>(...parsers: Parser<T>[]): Parser<T> =>
  (input, index = 0) => {
    const errors: string[] = [];

    for (const parser of parsers) {
      const result = parser(input, index);
      if (result.success) return result;
      if (!result.success) errors.push(...result.expected);
    }

    return {
      success: false,
      expected: [...new Set(errors)], // Unique errors
      index,
    };
  };

/**
 * Sequences multiple parsers, collecting their results. Builds complex parsers from simple ones.
 * @example
 * const abParser = seq(char('a'), char('b'));
 * abParser('abc', 0) // => { success: true, value: ['a', 'b'], index: 2 }
 */
export const seq =
  <T extends unknown[]>(
    ...parsers: { [K in keyof T]: Parser<T[K]> }
  ): Parser<T> =>
  (input, index = 0) => {
    const values: { [K in keyof T]: T[K] } = [] as { [K in keyof T]: T[K] };
    let currentIndex = index;

    for (const parser of parsers) {
      const result = parser(input, currentIndex);
      if (!result.success) return { ...result, index };
      values.push(result.value);
      currentIndex = result.index;
    }

    return { success: true, value: values as T, index: currentIndex };
  };

/**
 * Transforms parser result using a mapping function. Enables data normalization.
 * @example
 * const upperA = map(char('a'), s => s.toUpperCase());
 * upperA('apple', 0) // => { success: true, value: 'A', index: 1 }
 */
export const map =
  <T, U>(parser: Parser<T>, fn: (value: T) => U): Parser<U> =>
  (input, index = 0) => {
    const result = parser(input, index);
    return result.success ? { ...result, value: fn(result.value) } : result;
  };

/**
 * Repeatedly applies a parser zero or more times. Handles repetition patterns.
 * @example
 * const manyA = many(char('a'));
 * manyA('aaabbb', 0) // => { success: true, value: ['a','a','a'], index: 3 }
 */
export const many =
  <T>(parser: Parser<T>): Parser<T[]> =>
  (input, index = 0) => {
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

/**
 * Makes a parser optional. Returns undefined if parser fails. For non-critical elements.
 * @example
 * const optA = optional(char('a'));
 * optA('apple', 0) // => { success: true, value: 'a', index: 1 }
 * optA('banana', 0) // => { success: true, value: undefined, index: 0 }
 */
export const optional = <T>(parser: Parser<T>): Parser<T | undefined> =>
  alt(parser, succeed(undefined));

/**
 * Wraps a parser between start and end markers
 * @example
 * const quoted = between(char('"'), char('"'))(many(anyChar));
 */
export const between =
  (left: Parser<unknown>, right: Parser<unknown>) =>
  <T>(parser: Parser<T>): Parser<T> =>
    map(seq(left, parser, right), ([, value]) => value);

/**
 * Parses content after a prefix, ignoring the prefix
 * @example
 * const value = after(string('data:'))(jsonValue);
 */
export const after =
  (prefix: Parser<unknown>) =>
  <T>(parser: Parser<T>): Parser<T> =>
    map(seq(prefix, parser), ([, value]) => value);

/**
 * Parses content until a stop condition is met
 * @example
 * const commentContent = until(string('*'))(anyChar); 
 */
export const until =
  (stop: Parser<unknown>) =>
  <T>(parser: Parser<T>): Parser<T[]> => {
    const untilParser: Parser<T[]> = (input, index = 0) => {
      const results: T[] = [];
      let currentIndex = index;

      while (true) {
        const stopResult = stop(input, currentIndex);
        if (stopResult.success) break;

        const result = parser(input, currentIndex);
        if (!result.success) return result;

        results.push(result.value);
        currentIndex = result.index;
      }

      return { success: true, value: results, index: currentIndex };
    };

    return untilParser;
  };

/**
 * Succeeds if the parser would fail (zero-width)
 */
export const not =
  (parser: Parser<unknown>): Parser<null> =>
  (input, index = 0) => {
    const result = parser(input, index);
    return result.success
      ? {
          success: false,
          expected: [`not ${result.expected.join(' or ')}`], // Join array to string
          index,
        }
      : { success: true, value: null, index };
  };

/**
 * Fails if the exclusion parser matches
 */
export const except =
  (exclusion: Parser<unknown>) =>
  <T>(parser: Parser<T>): Parser<T> =>
  (input, index = 0) => {
    const excludeResult = exclusion(input, index);
    if (excludeResult.success) {
      return {
        success: false,
        expected: [`not ${excludeResult.expected.join(' or ')}`], // Join array
        index,
      };
    }
    return parser(input, index);
  };

/**
 * Matches any single character (fails at EOF)
 */
export const anyChar: Parser<string> = (input, index = 0) =>
  index < input.length
    ? { success: true, value: input[index], index: index + 1 }
    : { success: false, expected: ['any character'], index };

/**
 * Skips zero or more whitespace characters
 */
export const whitespace =
  (): Parser<string> =>
  (input, index = 0) => {
    const char = input[index];
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      return { success: true, value: char, index: index + 1 };
    }
    return { success: false, expected: ['whitespace'], index };
  };

/**
 * Skips zero or more whitespace characters
 */
export const whitespaces: Parser<void> = map(
  many(whitespace()),
  () => undefined,
);

/**
 * Matches any English letter (a-z, A-Z)
 * @example
 * letter()('apple') // => 'a'
 */
export const letter = (): Parser<string> => 
  char.match(/[a-zA-Z]/);

// Intuitive aliases
export const either = alt;
export const sequence = seq;
export const maybe = optional;
export const zeroOrMore = many;
