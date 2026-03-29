"use strict";

const { isVoidTag } = require("../html/void-tags");

/**
 * @typedef {{message: string, severity: "error" | "warning", start: number, end: number}} ConfigDiagnostic
 */

/**
 * @param {string} text
 * @returns {ConfigDiagnostic[]}
 */
function collectConfigDiagnostics(text) {
  let root;

  try {
    const parser = createParser(text);
    root = parser.parseValue();
    parser.skipWhitespaceAndComments();

    if (!parser.isAtEnd()) {
      throw parser.createError("Unexpected trailing content.");
    }
  } catch (error) {
    const start = Number.isInteger(error.position) ? error.position : 0;
    return [
      {
        message: `Invalid formatter config: ${error.message}`,
        severity: "error",
        start,
        end: Math.min(text.length, start + 1)
      }
    ];
  }

  return collectVoidTagSettingDiagnostics(root);
}

/**
 * @param {any} root
 * @returns {ConfigDiagnostic[]}
 */
function collectVoidTagSettingDiagnostics(root) {
  if (!root || root.type !== "object") {
    return [];
  }

  const tagsProperty = getObjectProperty(root, "tags");
  if (!tagsProperty || !tagsProperty.value || tagsProperty.value.type !== "object") {
    return [];
  }

  const diagnostics = [];

  for (const tagProperty of tagsProperty.value.properties) {
    const tagName = tagProperty.key.value;
    if (!isVoidTag(String(tagName).toLowerCase()) || !tagProperty.value || tagProperty.value.type !== "object") {
      continue;
    }

    const closingStyleProperty = getObjectProperty(tagProperty.value, "closingStyle");
    if (closingStyleProperty) {
      diagnostics.push({
        message: `Void tag "${tagName}" cannot use "closingStyle".`,
        severity: "error",
        start: closingStyleProperty.key.start,
        end: closingStyleProperty.value.end
      });
    }

    const closingTagPositionProperty = getObjectProperty(tagProperty.value, "closingTagPosition");
    if (closingTagPositionProperty) {
      diagnostics.push({
        message: `Void tag "${tagName}" cannot use "closingTagPosition".`,
        severity: "error",
        start: closingTagPositionProperty.key.start,
        end: closingTagPositionProperty.value.end
      });
    }
  }

  return diagnostics;
}

/**
 * @param {{properties: Array<{key: {value: string}, value: any}>}} objectNode
 * @param {string} keyName
 * @returns {{key: {value: string, start: number, end: number}, value: any} | null}
 */
function getObjectProperty(objectNode, keyName) {
  return objectNode.properties.find((property) => property.key.value === keyName) || null;
}

/**
 * @param {string} text
 * @returns {{
 *   parseValue(): any,
 *   skipWhitespaceAndComments(): void,
 *   isAtEnd(): boolean,
 *   createError(message: string): Error & {position: number}
 * }}
 */
function createParser(text) {
  let index = 0;

  function current() {
    return text[index];
  }

  function isAtEnd() {
    return index >= text.length;
  }

  function createError(message) {
    const error = new Error(message);
    error.position = index;
    return error;
  }

  function skipWhitespaceAndComments() {
    while (!isAtEnd()) {
      const char = current();
      const next = text[index + 1];

      if (/\s/.test(char)) {
        index += 1;
        continue;
      }

      if (char === "/" && next === "/") {
        index += 2;
        while (!isAtEnd() && current() !== "\n") {
          index += 1;
        }
        continue;
      }

      if (char === "/" && next === "*") {
        index += 2;
        while (!isAtEnd()) {
          if (current() === "*" && text[index + 1] === "/") {
            index += 2;
            break;
          }
          index += 1;
        }
        continue;
      }

      break;
    }
  }

  function parseValue() {
    skipWhitespaceAndComments();

    if (isAtEnd()) {
      throw createError("Unexpected end of file.");
    }

    const char = current();

    if (char === "{") {
      return parseObject();
    }

    if (char === "[") {
      return parseArray();
    }

    if (char === "\"" || char === "'") {
      return parseString();
    }

    if (char === "-" || /\d/.test(char)) {
      return parseNumber();
    }

    if (text.startsWith("true", index)) {
      const start = index;
      index += 4;
      return { type: "literal", value: true, start, end: index };
    }

    if (text.startsWith("false", index)) {
      const start = index;
      index += 5;
      return { type: "literal", value: false, start, end: index };
    }

    if (text.startsWith("null", index)) {
      const start = index;
      index += 4;
      return { type: "literal", value: null, start, end: index };
    }

    throw createError(`Unexpected token "${char}".`);
  }

  function parseObject() {
    const start = index;
    index += 1;
    const properties = [];

    skipWhitespaceAndComments();
    if (current() === "}") {
      index += 1;
      return { type: "object", properties, start, end: index };
    }

    while (!isAtEnd()) {
      skipWhitespaceAndComments();
      const key = parseString();

      skipWhitespaceAndComments();
      if (current() !== ":") {
        throw createError("Expected ':' after object key.");
      }
      index += 1;

      const value = parseValue();
      properties.push({ key, value });

      skipWhitespaceAndComments();
      if (current() === "}") {
        index += 1;
        return { type: "object", properties, start, end: index };
      }

      if (current() !== ",") {
        throw createError("Expected ',' or '}' in object.");
      }

      index += 1;
      skipWhitespaceAndComments();

      if (current() === "}") {
        index += 1;
        return { type: "object", properties, start, end: index };
      }
    }

    throw createError("Unterminated object.");
  }

  function parseArray() {
    const start = index;
    index += 1;
    const items = [];

    skipWhitespaceAndComments();
    if (current() === "]") {
      index += 1;
      return { type: "array", items, start, end: index };
    }

    while (!isAtEnd()) {
      const value = parseValue();
      items.push(value);

      skipWhitespaceAndComments();
      if (current() === "]") {
        index += 1;
        return { type: "array", items, start, end: index };
      }

      if (current() !== ",") {
        throw createError("Expected ',' or ']' in array.");
      }

      index += 1;
      skipWhitespaceAndComments();

      if (current() === "]") {
        index += 1;
        return { type: "array", items, start, end: index };
      }
    }

    throw createError("Unterminated array.");
  }

  function parseString() {
    const quote = current();
    if (quote !== "\"" && quote !== "'") {
      throw createError("Expected string.");
    }

    const start = index;
    index += 1;
    let value = "";

    while (!isAtEnd()) {
      const char = current();

      if (char === "\\") {
        const next = text[index + 1];
        if (next === undefined) {
          throw createError("Unterminated escape sequence.");
        }
        value += next;
        index += 2;
        continue;
      }

      if (char === quote) {
        index += 1;
        return { type: "string", value, start, end: index };
      }

      value += char;
      index += 1;
    }

    throw createError("Unterminated string.");
  }

  function parseNumber() {
    const start = index;

    if (current() === "-") {
      index += 1;
    }

    while (!isAtEnd() && /\d/.test(current())) {
      index += 1;
    }

    if (current() === ".") {
      index += 1;
      while (!isAtEnd() && /\d/.test(current())) {
        index += 1;
      }
    }

    const raw = text.slice(start, index);
    return { type: "literal", value: Number(raw), start, end: index };
  }

  return {
    parseValue,
    skipWhitespaceAndComments,
    isAtEnd,
    createError
  };
}

module.exports = {
  collectConfigDiagnostics
};
