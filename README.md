# http-cache-control-header-parse

Parse an HTTP `Cache-Control` header into directive objects, and read the delta-seconds value of directives such as `max-age`.

```js
import { parseCacheControl, findDirective, getDeltaSeconds } from './src/index.js';

const directives = parseCacheControl('public, max-age=600, no-cache="Set-Cookie"');
// [
//   { name: 'public', value: null },
//   { name: 'max-age', value: '600' },
//   { name: 'no-cache', value: '"Set-Cookie"' },
// ]

const maxAge = findDirective(directives, 'max-age');
if (maxAge !== null) {
  getDeltaSeconds(maxAge); // 600
}
```

## Why this exists

A `Cache-Control` header is a comma-separated list, but the comma is also legal inside a quoted string value, as in `no-cache="Set-Cookie, X-Other"`. A naive `header.split(',')` therefore produces a directive named `X-Other"` and loses the fact that the two tokens belong to one directive. This library scans the header instead, tracking quoted-string state and backslash escapes, so that a comma only separates directives when it appears at the top level.

The deliberate trade-off is that values are returned as raw strings rather than coerced numbers. The header grammar permits quoted strings, extension tokens, and values that are not numeric at all, and a caller may want the original spelling. The `getDeltaSeconds` helper performs the numeric interpretation separately, and returns `null` for values that are not a plain non-negative integer.

## The awkward edge

Directive names are lowercased during parsing, but values are not. `Max-Age=600` yields `{ name: 'max-age', value: '600' }`, and `no-cache="Set-Cookie"` keeps the quotes and the original casing of the value. If you compare values yourself, account for the fact that the header is not normalised for you.

`Cache-Control` permits the same directive to appear more than once. `findDirective` returns the first occurrence; the specification does not define which one wins, so the first is a predictable choice rather than a correct one.

## API

- `parseDirective(raw)` — parse one directive string. Throws `SyntaxError` if invalid, `TypeError` if `raw` is not a string.
- `parseCacheControl(header)` — parse a full header value into an array of `{ name, value }`. `value` is `null` for bare tokens. Throws `SyntaxError` on an unterminated quoted string.
- `getDeltaSeconds(directive)` — return the integer value of a directive, or `null` if it is not a non-negative integer. Quoted numeric values are accepted.
- `findDirective(directives, name)` — return the first directive with the given name (case-insensitive), or `null`.

## Tests

```sh
node --test
```

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

## Limitations

Values are coerced to floats, so very large integers lose precision. If you need
exact integer aggregates over a window, this is the wrong tool.

