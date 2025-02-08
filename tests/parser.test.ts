import { describe, expect, test } from 'bun:test';
import {
  after,
  alt,
  andThen,
  anyChar,
  between,
  char,
  digit,
  eof,
  except,
  integer,
  letter,
  many,
  many1,
  not,
  optional,
  sepBy,
  seq,
  string,
  token,
  until,
  whitespace,
  whitespaces,
} from '../src';

describe('Core Parsers', () => {
  test('char parser', () => {
    expect(char('a')('abc', 0)).toMatchObject({ success: true, value: 'a' });
    expect(char('a')('bac', 0)).toMatchObject({
      success: false,
      expected: ["'a'"],
    });
  });

  test('string parser', () => {
    expect(string('hello')('hello world', 0)).toMatchObject({
      success: true,
      value: 'hello',
    });
    expect(string('hello')('hi world', 0)).toMatchObject({
      success: false,
      expected: ["'hello'"],
    });
  });
});

describe('Chaining Combinators', () => {
  test('andThen chains parsers', () => {
    // Test successful chain
    const parser = andThen(
      integer(),
      (n) => string('_'.repeat(n)), // Actually use the integer to determine underscore count
      (s) => many(char(s[0])), // Now s is the underscore string from previous step
    );

    // Test valid input
    expect(parser('3___', 0)).toMatchObject({
      success: true,
      value: ['_', '_', '_'],
      index: 4, // 1 (for '3') + 3 (for '___')
    });

    // Test failure in first parser
    expect(parser('a___', 0)).toMatchObject({
      success: false,
      expected: ['digit'], // Now gets the underlying error
      index: 0,
    });

    // Test failure in second parser
    expect(parser('2_', 0)).toMatchObject({
      // Reduced to 1 underscore
      success: false,
      expected: ["'__'"], // Expecting 2 underscores
      index: 1, // Fails after parsing integer 2
    });

    // Test type transitions
    const result = parser('3___', 0);
    if (result.success) {
      // Should have correct chained types: number -> string -> string[]
      // @ts-expect-error - should fail type check
      const num: number = result.value;
      // @ts-expect-error - should fail type check
      const str: string = result.value;
      const arr: string[] = result.value; // Valid type
      expect(arr).toEqual(['_', '_', '_']);
    }

    // Test index positions
    const stagedCheck = parser('3___abc', 0);
    if (stagedCheck.success) {
      expect(stagedCheck.index).toBe(4); // Should stop after parsing underscores
    }
  });

  test('andThen handles empty chain', () => {
    const parser = andThen(string('test'));
    expect(parser('test', 0)).toMatchObject({
      success: true,
      value: 'test',
    });
    // Verify type is preserved
    const result = parser('test', 0);
    if (result.success) {
      const str: string = result.value;
      expect(str).toBe('test');
    }
  });

  test('andThen maintains error positions', () => {
    const parser = andThen(
      char('a'),
      () => char('b'),
      () => char('c'),
    );

    const result = parser('abd', 0);
    expect(result).toMatchObject({
      success: false,
      expected: ["'c'"],
      index: 2,
    });
  });
});

describe('Combinators', () => {
  test('alt chooses first successful parser', () => {
    const parser = alt(char('a'), char('b'));
    expect(parser('abc', 0)).toMatchObject({ value: 'a' });
    expect(parser('bac', 0)).toMatchObject({ value: 'b' });
    expect(parser('cab', 0)).toMatchObject({
      success: false,
      expected: ["'a'", "'b'"],
    });
  });

  test('seq combines parsers sequentially', () => {
    const parser = seq(char('a'), char('b'));
    expect(parser('abc', 0)).toMatchObject({ value: ['a', 'b'] });
    expect(parser('acb', 0)).toMatchObject({
      success: false,
      expected: ["'b'"],
    });
  });
});

describe('Recursive Combinators', () => {
  test('many combinator', () => {
    const p = many(char('a'));
    expect(p('aaab', 0)).toMatchObject({
      success: true,
      value: ['a', 'a', 'a'],
    });
    expect(p('baaa', 0)).toMatchObject({ success: true, value: [], index: 0 });
  });

  test('optional combinator', () => {
    const p = seq(optional(char('a')), char('b'));
    expect(p('ab', 0)).toMatchObject({ value: ['a', 'b'] });
    expect(p('b', 0)).toMatchObject({ value: [undefined, 'b'] });
  });
});

test('char parser without explicit index', () => {
  expect(char('a')('abc')).toMatchObject({
    success: true,
    value: 'a',
    index: 1,
  });
});

test('string parser with default index', () => {
  expect(string('hello')('hello world')).toMatchObject({
    success: true,
    value: 'hello',
    index: 5,
  });
});

describe('Convenience Combinators', () => {
  test('between wraps content', () => {
    const p = between(char('('), char(')'))(many(char('1')));
    expect(p('(111)')).toMatchObject({ value: ['1', '1', '1'] });
  });

  test('after skips prefix', () => {
    const p = after(string('data:'))(many(char('h')));
    expect(p('data:hhh')).toMatchObject({ value: ['h', 'h', 'h'] });
  });

  test('until stops at marker', () => {
    const p = until(string('*/'))(anyChar);
    expect(p('abc*/def')).toMatchObject({
      value: ['a', 'b', 'c'],
      index: 3,
    });
  });

  test('not succeeds when parser fails', () => {
    const p = not(char('a'));
    expect(p('b')).toMatchObject({ success: true });
    expect(p('a')).toMatchObject({
      success: false,
      expected: ["not 'a'"],
    });
  });

  test('except fails when parser succeeds', () => {
    const p = except(char('a'))(char('b'));
    expect(p('b')).toMatchObject({ success: true });
    expect(p('a')).toMatchObject({
      success: false,
      expected: ["not 'a'"],
    });
  });
});

describe('Utility Parsers', () => {
  test('anyChar matches any character', () => {
    expect(anyChar('a')).toMatchObject({ success: true, value: 'a' });
    expect(anyChar('')).toMatchObject({
      success: false,
      expected: ['any character'],
    });
  });

  test('whitespace matches whitespace characters', () => {
    expect(whitespace()(' ')).toMatchObject({ success: true, value: ' ' });
    expect(whitespace()('\t')).toMatchObject({ success: true, value: '\t' });
    expect(whitespace()('\n')).toMatchObject({ success: true, value: '\n' });
    expect(whitespace()('\r')).toMatchObject({ success: true, value: '\r' });
    expect(whitespace()('a')).toMatchObject({
      success: false,
      expected: ['whitespace'],
    });
  });

  test('whitespaces skips multiple whitespace', () => {
    const p = whitespaces();
    expect(p('   \t\n')).toMatchObject({
      success: true,
      index: 5,
    });
  });
});

describe('New Combinators', () => {
  test('sepBy handles comma-separated values', () => {
    const p = sepBy(char(','))(letter());
    expect(p('a,b,c')).toMatchObject({
      value: ['a', 'b', 'c'],
      index: 5,
    });
  });

  test('token skips whitespace', () => {
    const p = token(string('function'));
    expect(p('function   (')).toMatchObject({
      value: 'function',
      index: 11, // 'function' + 3 spaces
    });
  });

  test('eof enforces end condition', () => {
    const p = eof(string('test'));
    expect(p('test')).toMatchObject({ success: true });
    expect(p('test ')).toMatchObject({
      success: false,
      expected: ['end of input'],
    });
  });

  test('digit parses single digit', () => {
    expect(digit()('1')).toMatchObject({ success: true, value: '1' });
    expect(digit()('a')).toMatchObject({ success: false });
  });

  test('integer parses integers', () => {
    expect(integer()('123')).toMatchObject({ success: true, value: 123 });
    expect(integer()('-456')).toMatchObject({ success: true, value: -456 });
    expect(integer()('+789')).toMatchObject({ success: true, value: 789 });
    expect(integer()('abc')).toMatchObject({ success: false });
  });
});
