# JSON Parser Tutorial

## Step 1: Basic Values
```typescript
import { string, map } from 'combo-parser';

const jsonNull = string('null').map(() => null);
const jsonBool = string('true').map(() => true);
```

## Step 2: Numbers and Strings
```typescript
import { many, digit, char } from 'combo-parser';

const jsonNumber = many(digit()).map(digits => 
  Number(digits.join(''))
);

const jsonString = between(char('"'), char('"'))(
  many(char.match(c => c !== '"'))
).map(chars => chars.join(''));
```

[Continue to arrays and objects...]
