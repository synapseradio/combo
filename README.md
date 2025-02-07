# Combo - Parser Combinators for TypeScript

[![CI Status](https://github.com/yourusername/combo/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/combo/actions)
[![Coverage](https://img.shields.io/codecov/c/github/yourusername/combo)](https://codecov.io/gh/yourusername/combo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A lightweight, type-safe parser combinator library for building efficient parsers in TypeScript.

## Features

- 🧩 Intuitive combinator API
- 🚀 Recursive parser support
- 📍 Precise error locations
- 🧠 Zero dependencies
- 📚 100% test coverage

## Installation

```bash
npm install combo-parser
# or
bun add combo-parser
```

## Quick Example

```typescript
import { char, either, sequence, many, map } from 'combo-parser';

// Parse either a quoted string or unquoted word
const stringParser = either(
  sequence(char('"'), many(char.match(/[^"]/)), char('"')),
  many(char.match(/\w/))
).map(([_, content]) => content.join(''));

// Parse "hello" or hello
console.log(stringParser('"hello"', 0)); // { success: true, value: 'hello' }
console.log(stringParser('world', 0));    // { success: true, value: 'world' }
```

## Core Concepts

### Basic Parsers
```typescript
import { char, digit, letters } from 'combo-parser';

char('a')    // Match exact character
digit()      // Match 0-9  
letters()    // Match a-zA-Z
```

### Combinators
```typescript
import { either, sequence, many, optional } from 'combo-parser';

either(a, b)     // Try parser A, then B
sequence(a, b)   // Match A then B
many(a)          // Match 0+ occurrences
optional(a)      // Make parser optional
```

### Error Handling
```typescript
const parser = either(digit(), letters());
const result = parser('!', 0);

if (!result.success) {
  console.log(`Error at position ${result.index}:`);
  result.errors.forEach(err => 
    console.log(`- Expected ${err.expected}`)
  );
}
```

## Tutorial: JSON Parser

See our [step-by-step guide](docs/json-parser.md) to build a complete JSON parser.

## API Reference

Full documentation available at [docs.api.md](docs/api.md)

---

[Contributing](CONTRIBUTING.md) | [Changelog](CHANGELOG.md) | [Code of Conduct](CODE_OF_CONDUCT.md)
