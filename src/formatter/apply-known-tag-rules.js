"use strict";

const { getTagRule } = require("../rules/tag-matcher");
const { sortAttributes } = require("../rules/attribute-order");
const {
  appendExplicitClosingTag,
  resolveClosingStyle,
  serializeStartTag
} = require("./tag-serializer");

/**
 * Applies tag-specific formatting only to tags explicitly configured in `config.tags`.
 * Unknown tags are left untouched so they remain indentation-only.
 *
 * @param {string} text
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {object} config
 * @param {{debug(message: string): void, warn(message: string): void}} logger
 * @returns {string}
 */
function applyKnownTagRules(text, tokens, config, logger) {
  const replacements = [];
  const consumedTokenIndexes = new Set();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (consumedTokenIndexes.has(index) || token.kind !== "start" || !token.tagName) {
      continue;
    }

    const rule = getTagRule(token.tagName, config);
    if (!rule) {
      continue;
    }

    const result = buildTagReplacement(text, tokens, index, rule, logger);
    if (!result) {
      continue;
    }

    replacements.push(result.replacement);
    for (const consumed of result.consumedTokenIndexes) {
      consumedTokenIndexes.add(consumed);
    }
  }

  if (!replacements.length) {
    return text;
  }

  replacements.sort((left, right) => right.start - left.start);
  let output = text;
  for (const replacement of replacements) {
    output = `${output.slice(0, replacement.start)}${replacement.text}${output.slice(replacement.end)}`;
  }

  return output;
}

/**
 * @param {string} text
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {number} tokenIndex
 * @param {object} rule
 * @param {{debug(message: string): void, warn(message: string): void}} logger
 * @returns {{replacement: {start: number, end: number, text: string}, consumedTokenIndexes: number[]} | null}
 */
function buildTagReplacement(text, tokens, tokenIndex, rule, logger) {
  const token = tokens[tokenIndex];
  const sortedAttributes = sortAttributes(token.attributes, rule);
  const desiredClosingStyle = resolveClosingStyle(text, tokens, tokenIndex, rule);
  const serializedStartTag = serializeStartTag(token.tagName, sortedAttributes, desiredClosingStyle, rule, token.raw);

  if (desiredClosingStyle === "self-closing") {
    return buildSelfClosingReplacement(text, tokens, tokenIndex, serializedStartTag, sortedAttributes, rule, logger);
  }

  if (desiredClosingStyle === "explicit" && token.selfClosing) {
    return {
      replacement: {
        start: token.start,
        end: token.end,
        text: appendExplicitClosingTag(serializedStartTag, token.tagName, rule)
      },
      consumedTokenIndexes: [tokenIndex]
    };
  }

  if (desiredClosingStyle === "explicit" && token.pairIndex !== null) {
    const endToken = tokens[token.pairIndex];
    const between = text.slice(token.end, endToken.start);
    const explicitTagText = appendExplicitClosingTag(serializedStartTag, token.tagName, rule);
    const multilineExplicit = /\n/.test(serializedStartTag);

    if (multilineExplicit || between.trim().length === 0) {
      return {
        replacement: {
          start: token.start,
          end: endToken.end,
          text: explicitTagText
        },
        consumedTokenIndexes: [tokenIndex, token.pairIndex]
      };
    }
  }

  return {
    replacement: {
      start: token.start,
      end: token.end,
      text: serializedStartTag
    },
    consumedTokenIndexes: [tokenIndex]
  };
}

/**
 * @param {string} text
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {number} tokenIndex
 * @param {string} serializedStartTag
 * @param {import("../parser/html-tokenizer").AttributeToken[]} sortedAttributes
 * @param {object} rule
 * @param {{debug(message: string): void, warn(message: string): void}} logger
 * @returns {{replacement: {start: number, end: number, text: string}, consumedTokenIndexes: number[]}}
 */
function buildSelfClosingReplacement(text, tokens, tokenIndex, serializedStartTag, sortedAttributes, rule, logger) {
  const token = tokens[tokenIndex];

  if (token.pairIndex !== null) {
    const endToken = tokens[token.pairIndex];
    const between = text.slice(token.end, endToken.start);
    if (between.trim().length > 0) {
      logger.warn(`Skipped self-closing conversion for <${token.tagName}> because it contains content.`);
      return {
        replacement: {
          start: token.start,
          end: token.end,
          text: serializeStartTag(token.tagName, sortedAttributes, "explicit", rule, token.raw)
        },
        consumedTokenIndexes: [tokenIndex]
      };
    }

    return {
      replacement: {
        start: token.start,
        end: endToken.end,
        text: serializedStartTag
      },
      consumedTokenIndexes: [tokenIndex, token.pairIndex]
    };
  }

  return {
    replacement: {
      start: token.start,
      end: token.end,
      text: serializedStartTag
    },
    consumedTokenIndexes: [tokenIndex]
  };
}

module.exports = {
  applyKnownTagRules
};
