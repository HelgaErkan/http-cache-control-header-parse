const DIRECTIVE_RE = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+)(?:=([\s\S]*))?$/;

/**
 * Parse a single Cache-Control directive of the form `token` or `token=value`.
 *
 * The value, when present, is returned as a string exactly as it appeared in
 * the header, minus any surrounding optional whitespace. We deliberately do
 * not coerce it to a number here: a caller may want the raw token, and the
 * header grammar allows quoted strings and arbitrary extension tokens.
 *
 * @param {string} raw - one comma-separated slice of a Cache-Control header
 * @returns {{name: string, value: string|null}}
 * @throws {TypeError} if `raw` is not a string
 */
export function parseDirective(raw) {
  if (typeof raw !== 'string') {
    throw new TypeError('directive must be a string');
  }

  const trimmed = raw.trim();
  const match = DIRECTIVE_RE.exec(trimmed);
  if (match === null) {
    throw new SyntaxError(`invalid cache-control directive: ${JSON.stringify(raw)}`);
  }

  const name = match[1].toLowerCase();
  const value = match[2] === undefined ? null : match[2].trim();
  return { name, value };
}

/**
 * Parse a full Cache-Control header value into an array of directives.
 *
 * Splitting on commas is not enough on its own: the grammar permits a quoted
 * string to contain commas (for example `no-cache="Set-Cookie, X-Other"`), so
 * we scan the header and only treat a comma as a separator when it is not
 * inside a quoted string. Backslash escapes inside quoted strings are
 * recognised so that `\"` does not close the string early.
 *
 * @param {string} header - the raw Cache-Control header value
 * @returns {Array<{name: string, value: string|null}>}
 * @throws {TypeError} if `header` is not a string
 * @throws {SyntaxError} on an unterminated quoted string or an invalid directive
 */
export function parseCacheControl(header) {
  if (typeof header !== 'string') {
    throw new TypeError('header must be a string');
  }

  const slices = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;

  for (let i = 0; i < header.length; i += 1) {
    const ch = header[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inQuotes) {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      slices.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  if (inQuotes) {
    throw new SyntaxError('unterminated quoted string in cache-control header');
  }

  slices.push(current);

  const directives = [];
  for (const slice of slices) {
    if (slice.trim() === '') {
      continue;
    }
    directives.push(parseDirective(slice));
  }
  return directives;
}

/**
 * Return the delta-seconds value of a directive, or null when the directive
 * does not carry a numeric value.
 *
 * The HTTP grammar defines delta-seconds as a non-negative decimal integer.
 * We reject anything with a sign, a decimal point, or trailing characters so
 * that a malformed `max-age=abc` is not silently treated as zero. Quoted
 * numeric values are accepted because some intermediaries emit them.
 *
 * @param {{name: string, value: string|null}} directive
 * @returns {number|null}
 * @throws {TypeError} if the argument is not a directive-shaped object
 */
export function getDeltaSeconds(directive) {
  if (directive === null || typeof directive !== 'object') {
    throw new TypeError('directive must be an object');
  }
  if (typeof directive.name !== 'string') {
    throw new TypeError('directive.name must be a string');
  }
  const value = directive.value;
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError('directive.value must be a string or null');
  }

  let text = value;
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }
  return parsed;
}

/**
 * Find the first directive with the given name (case-insensitive).
 *
 * Cache-Control allows the same directive to appear more than once; the
 * specification does not define which wins. We return the first occurrence so
 * that behaviour is predictable rather than dependent on iteration order of a
 * map.
 *
 * @param {Array<{name: string, value: string|null}>} directives
 * @param {string} name
 * @returns {{name: string, value: string|null}|null}
 * @throws {TypeError} if the arguments are the wrong shape
 */
export function findDirective(directives, name) {
  if (!Array.isArray(directives)) {
    throw new TypeError('directives must be an array');
  }
  if (typeof name !== 'string') {
    throw new TypeError('name must be a string');
  }
  const needle = name.toLowerCase();
  for (const directive of directives) {
    if (directive.name === needle) {
      return directive;
    }
  }
  return null;
}
