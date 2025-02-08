import type { ParseResult, Parser } from './-types';

/**
 * Memoization decorator for parsers. Caches results at each position to prevent
 * redundant parsing. Essential for:
 * - Recursive grammars
 * - Looping constructs
 * - Performance-critical paths
 * @example
 * const memoizedExpr = memoize(expressionParser);
 * memoizedExpr('(1+2)*3'); // Caches intermediate results
 */
const memo = new WeakMap<Parser<unknown>, Map<number, ParseResult<unknown>>>();

export const memoize = <T>(parser: Parser<T>): Parser<T> => {
  return (input: string, index = 0) => {
    if (!memo.has(parser)) {
      memo.set(parser, new Map());
    }
    const cache = memo.get(parser);
    if (!cache) {
      throw new Error('Cache not found despite being set');
    }

    const cached = cache.get(index);
    if (cached) return cached as ParseResult<T>;

    const result = parser(input, index);
    cache.set(index, result);
    return result as ParseResult<T>;
  };
};

/**
 * Matches a single specific character. Basic building block for token recognition.
 * @example
 * const parseA = char('a');
 * parseA('apple', 0); // => { success: true, value: 'a', index: 1 }
 */
export const char = (c: string): Parser<string> => {
  const expected = [`'${c}'`];
  return (input: string, index = 0) =>
    input[index] === c
      ? { success: true, value: c, index: index + 1 }
      : { success: false, expected, index };
};

/**
 * Matches an exact string sequence. Essential for keyword recognition.
 * @example
 * const parseHello = string('hello');
 * parseHello('hello world', 0) // => { success: true, value: 'hello', index: 5 }
 */
export const string = (s: string): Parser<string> => {
  const len = s.length;
  return (input: string, index = 0) => {
    if (input.slice(index, index + len) === s) {
      return { success: true, value: s, index: index + len };
    }
    return { success: false, expected: [`'${s}'`], index };
  };
};

/**
 * Always succeeds with provided value, consumes no input. Useful for default values.
 * @example
 * const answer = succeed(42);
 * answer('any input', 0) // => { success: true, value: 42, index: 0 }
 */
export const succeed =
  <T>(value: T): Parser<T> =>
  (_: string, index = 0) => ({ success: true, value, index });

/**
 * Always fails with specified expectation. Used for expected error reporting.
 * @example
 * const failNum = fail<number>('number');
 * failNum('abc', 0) // => { success: false, expected: 'number', index: 0 }
 */
export const fail =
  <T>(expected: string): Parser<T> =>
  (_: string, index = 0) => ({ success: false, expected: [expected], index });

/**
 * Tries multiple parsers in order, returning first success. Enables alternative patterns.
 * @example
 * const aOrB = alt(char('a'), char('b'));
 * aOrB('banana', 0) // => { success: true, value: 'b', index: 1 }
 */
export const alt =
  <T>(...parsers: Parser<T>[]): Parser<T> =>
  (input: string, index = 0) => {
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
  (input: string, index = 0) => {
    const values = [] as unknown as T;
    let currentIndex = index;

    for (const parser of parsers as Parser<T[number]>[]) {
      const result = parser(input, currentIndex);
      if (!result.success) return result as ParseResult<T>;
      values.push(result.value as T[number]);
      currentIndex = result.index;
    }

    return { success: true, value: values, index: currentIndex };
  };

/**
 * Transforms parser result using a mapping function. Enables data normalization.
 * @example
 * const upperA = map(char('a'), s => s.toUpperCase());
 * upperA('apple', 0) // => { success: true, value: 'A', index: 1 }
 */
export const map =
  <T, U>(
    parser: Parser<T>,
    fn: (value: T) => U,
    validate?: (value: T) => boolean,
  ): Parser<U> =>
  (input: string, index = 0) => {
    const result = parser(input, index);
    if (!result.success) return result as ParseResult<U>; // Safe cast
    if (validate && !validate(result.value)) {
      return {
        success: false,
        expected: ['validated value'],
        index,
      };
    }
    return {
      ...result,
      value: fn(result.value),
    };
  };

/**
 * Repeatedly applies a parser zero or more times. Handles repetition patterns.
 * @example
 * const manyA = many(char('a'));
 * manyA('aaabbb', 0) // => { success: true, value: ['a','a','a'], index: 3 }
 */
export const many = <T>(parser: Parser<T>): Parser<T[]> => {
  const parserFn = parser as (input: string, index: number) => ParseResult<T>;
  return (input: string, index = 0) => {
    const values: T[] = [];
    let currentIndex = index;
    let result: ParseResult<T>;

    // biome-ignore lint/suspicious/noAssignInExpressions: performance optimization
    while ((result = parserFn(input, currentIndex)).success) {
      values.push(result.value);
      currentIndex = result.index;
    }

    return { success: true, value: values, index: currentIndex };
  };
};

/**
 * Repeatedly applies a parser one or more times.
 * @example
 * const many1A = many1(char('a'));
 * many1A('aaabbb', 0) // => { success: true, value: ['a','a','a'], index: 3 }
 * many1A('bbbaaa', 0) // => { success: false, value: [], index: 0 }
 */
export const many1 =
  <T>(parser: Parser<T>): Parser<T[]> =>
  (input: string, index = 0) => {
    const values: T[] = [];
    let currentIndex = index;

    const firstResult = parser(input, currentIndex);
    if (!firstResult.success) return firstResult;
    values.push(firstResult.value);
    currentIndex = firstResult.index;

    while (true) {
      const result = parser(input, currentIndex);
      if (!result.success) break;
      values.push(result.value);
      currentIndex = result.index;
    }

    return {
      success: true,
      value: values as T[], // Explicit array type
      index: currentIndex,
    };
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
    map(seq(left, parser, right), (result: [unknown, T, unknown]) => result[1]);

/**
 * Parses content after a prefix, ignoring the prefix
 * @example
 * const value = after(string('data:'))(jsonValue);
 */
export const after =
  (prefix: Parser<unknown>) =>
  <T>(parser: Parser<T>): Parser<T> =>
    map(seq(prefix, parser) as Parser<[unknown, T]>, ([, value]) => value);

/**
 * Parses content until a stop condition is met
 * @example
 * // Parse list items until closing bracket
 * const listParser = between(
 *   char('['),
 *   char(']')
 * )(until(char(']'))(many(letter())));
 *
 * listParser('[abc]def') // => { value: ['a','b','c'], index: 4 }
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
 * Negative lookahead assertion. Succeeds if the parser would fail.
 * Useful for:
 * - Reserved keyword validation
 * - Syntax boundary detection
 * - Conditional parsing logic
 * @example
 * const notKeyword = seq(not(string("function")), identifier);
 * notKeyword('function'); // Fails as expected
 */
export const not =
  (parser: Parser<unknown>): Parser<null> =>
  (input: string, index = 0) => {
    const result = parser(input, index);
    return result.success
      ? {
          success: false,
          // Use parsed value to generate error message
          expected: [`not '${String(result.value)}'`],
          index,
        }
      : { success: true, value: null, index };
  };

/**
 * Exclusion combinator. Fails if exclusion parser matches first.
 * Typical uses:
 * - Blocking reserved words in identifiers
 * - Preventing syntax collisions
 * - Context-sensitive parsing
 * @example
 * const nonNumericId = except(digit())(many1(letter()));
 * nonNumericId('a1'); // Fails on '1'
 */
export const except =
  (exclusion: Parser<unknown>) =>
  <T>(parser: Parser<T>): Parser<T> =>
  (input: string, index = 0) => {
    const excludeResult = exclusion(input, index);
    if (excludeResult.success) {
      return {
        success: false,
        // Use parsed value for error message
        expected: [`not '${String(excludeResult.value)}'`],
        index,
      };
    }
    return parser(input, index);
  };

/**
 * Universal character consumer. Core building block for:
 * - Custom token parsers
 * - Low-level text processing
 * - Fallback character handling
 * @example
 * const parseFirstChar = anyChar;
 * parseFirstChar('abc'); // => 'a'
 */
export const anyChar: Parser<string> = (input: string, index = 0) =>
  index < input.length
    ? { success: true, value: input[index], index: index + 1 }
    : { success: false, expected: ['any character'], index };

/**
 * Single whitespace detector. Foundational for:
 * - Space-sensitive formats
 * - Column-aware parsing
 * - Mixed whitespace handling
 * @example
 * const tabParser = whitespace();
 * tabParser('\t'); // => '\t'
 */
export const whitespace =
  (): Parser<string> =>
  (input: string, index = 0) => {
    const char = input[index];
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      return { success: true, value: char, index: index + 1 };
    }
    return { success: false, expected: ['whitespace'], index };
  };

/**
 * Bulk whitespace consumer. Critical for:
 * - Language with insignificant whitespace
 * - Pre-token trimming
 * - Formatting-agnostic parsing
 * @example
 * const ws = whitespaces();
 * ws('   \t\n'); // Skips 5 chars
 */
export const whitespaces =
  (): Parser<void> =>
  (input: string, index = 0) => {
    let currentIndex = index;
    while (currentIndex < input.length && /\s/.test(input[currentIndex]))
      currentIndex++;
    return { success: true, value: undefined, index: currentIndex };
  };

/**
 * Matches any English letter (a-z, A-Z)
 * @example
 * letter()('apple') // => 'a'
 */
export const letter = (): Parser<string> =>
  map(
    anyChar as Parser<string>,
    (c: string) => {
      if (/^[a-zA-Z]$/.test(c)) return c;
      throw new Error('Not a letter');
    },
    (c: string) => /^[a-zA-Z]$/.test(c),
  );

/**
 * Parses a single digit (0-9)
 * @example
 * digit()('123') // => '1'
 */
export const digit = (): Parser<string> =>
  map(
    anyChar,
    (c: string) => {
      // Explicit type
      if (/\d/.test(c)) return c;
      throw new Error('Not a digit');
    },
    (c: string) => /\d/.test(c), // Explicit type
  );

/**
 * Parses an integer with optional sign
 * @example
 * integer()('-123') // => -123
 */
export const integer = (): Parser<number> =>
  map(
    seq(optional(alt(char('-'), char('+'))), many1(digit())),
    ([sign, digits]) => {
      const num = Number.parseInt(digits.join(''), 10);
      return sign === '-' ? -num : num;
    },
    ([, digits]) => digits.length > 0,
  );

/**
 * Parses values separated by a delimiter
 * @example
 * sepBy(char(','))(letter())('a,b,c') // => ['a','b','c']
 */
export const sepBy =
  <S>(separator: Parser<S>) =>
  <T>(item: Parser<T>): Parser<T[]> =>
    map(seq(item, many(seq(separator, item))), (result: [T, Array<[S, T]>]) => [
      result[0],
      ...result[1].map(([, i]) => i),
    ]);

/**
 * Parses a token followed by optional whitespace
 * @example
 * token(string('let'))('let 123') // => 'let' (index after whitespace)
 */
export const token = <T>(parser: Parser<T>): Parser<T> =>
  map(seq(parser, whitespaces()), ([value]) => value);

type InferParserType<P extends Parser<unknown>> = P extends Parser<infer T>
  ? T
  : never;

type AndThenChain<
  T,
  Fns extends ((value: any) => Parser<any>)[],
> = Fns extends [infer First, ...infer Rest]
  ? First extends (value: T) => Parser<infer U>
    ? AndThenChain<U, Rest>
    : never
  : T;

export const andThen = <T, Fns extends ((value: T) => Parser<any>)[]>(
  parser: Parser<T>,
  ...fns: Fns & {
    [K in keyof Fns]: K extends number
      ? Fns[K] extends (value: infer V) => Parser<infer W>
        ? (value: V) => Parser<W>
        : never
      : never;
  }
): Parser<AndThenChain<T, Fns>> => {
  return fns.reduce(
    (currentParser, fn) => (input: string, index: number) => {
      const result = currentParser(input, index);
      return result.success
        ? (fn as (value: T) => Parser<any>)(result.value)(input, result.index)
        : result;
    },
    parser,
  ) as Parser<AndThenChain<T, Fns>>;
};

/**
 * Provides fallback error messages
 * @example
 * recoverWith(char('a'), ['letter a'])('b') // => expects 'letter a'
 */
export const recoverWith =
  <T>(parser: Parser<T>, expected: string[]): Parser<T> =>
  (input, index = 0) => {
    const result = parser(input, index);
    return result.success
      ? result
      : {
          success: false,
          expected,
          index: result.index,
        };
  };

/**
 * Parses without consuming input (zero-width assertion)
 * @example
 * peek(string('http'))('https') // success (index remains 0)
 */
export const peek =
  <T>(parser: Parser<T>): Parser<T> =>
  (input, index = 0) => {
    const result = parser(input, index);
    return result.success
      ? { ...result, index } // Reset index
      : result;
  };

/**
 * Ensures parser consumes entire input
 * @example
 * eof(string('hello'))('hello') // success
 * eof(string('hello'))('helloworld') // fails
 */
export const eof =
  <T>(parser: Parser<T>): Parser<T> =>
  (input, index = 0) => {
    const result = parser(input, index);
    if (!result.success) return result;
    return result.index === input.length
      ? result
      : {
          success: false,
          expected: ['end of input'],
          index: result.index,
        };
  };

/**
 * Alias collection for API clarity:
 * - `either`: Alternative naming for alt()
 * - `sequence`: Explicit sequencing intent
 * - `maybe`: Semantic optionality
 * - `zeroOrMore`: Clear repetition intent
 */

export const either = alt;
export const sequence = seq;
export const maybe = optional;
export const zeroOrMore = many;
