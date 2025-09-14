# Crazy Parser

A light-weight parser combinator.

## Install

```sh
npm i crazy-parser
```

## Example

### Sign Parser

Import:

```ts
import {char} from "crazy-parser"
```

Build a sign parser:

```ts
const pSign = char("+").or(char("-")) 
```

Represent it with booleans:

```ts
const pSign = 
    char("+").cmap(true)
        .or(char("-").cmap(false))
```

Parse a sign:

```ts
console.log(pSign.eval("+")) // true
console.log(pSign.eval("-")) // false
console.log(pSign.eval("???") instanceof Error) // true
```

Add custom error messages:

```ts
class MissingSign extends Error {}

const pSign =
    char("+").cmap(true)
        .or(char("-").cmap(false))
        .error(new MissingSign())
```

### Time Parser

```ts
import {digit} from "crazy-parser"

// Parse current hour
const d24 =
    // 2 digits
    digit.x(2)
        // Map them to a number
        .map(cs => parseInt(cs.join("")))
        // Add a constrain
        .where(x => 0 <= x && x <= 23)

// Parse current minute & second
const d60 = digit.x(2)
    .map(cs => parseInt(cs.join("")))
    .where(h => 0 <= h && h <= 59)

// Insert colons between them
const time = template`${d24}:${d60}:${d60}`
    // There shouldn't be anything else after the time
    ._$(eof)

console.log(time.eval("12:34:56"))
console.log(time.eval("12:34:56?") instanceof Error) // true
console.log(time.eval("99:99:99") instanceof Error) // true
console.log(time.eval("9:9:9") instanceof Error) // true
```

You can go to [test](test/parser.test.ts) folder for more examples.
If you'd like to read the docs and the signatures, please go to [the main module](./src/index.ts). 

## Development

### Using make

Please make sure you have **node**, **tsc** and **vitest** installed.

#### Build

```sh
make
```

#### Build a tarball

```sh
make pack
```

#### Clean up

```sh
make clean
```

#### Test

The test takes about 6 seconds on my machine.

```sh
make test
```

### Using npm

Please make sure you have **tsc** and **vitest** installed.

#### Build

```sh
npm run build
```

#### Build a tarball

```sh
npm run build
npm pack
```

#### Clean up

```sh
npm run clean
```

#### Test

```sh
npm run clean
npm run test
```
