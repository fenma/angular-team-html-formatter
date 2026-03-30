"use strict";

const { getTagRule } = require("../rules/tag-matcher");
const { arrangeAttributes } = require("../rules/attribute-order");
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
  const arrangedAttributes = arrangeAttributes(token.attributes, rule);
  const desiredClosingStyle = resolveClosingStyle(text, tokens, tokenIndex, rule);
  const serializedStartTag = serializeStartTag(
    token.tagName,
    arrangedAttributes.firstLineAttributes,
    arrangedAttributes.remainingAttributes,
    desiredClosingStyle,
    rule,
    token.raw
  );

  if (desiredClosingStyle === "self-closing") {
    return buildSelfClosingReplacement(text, tokens, tokenIndex, serializedStartTag, arrangedAttributes, rule, logger);
  }

  if (desiredClosingStyle === "explicit" && token.selfClosing) {
    const trailingEndTokenIndex = findTrailingExplicitEndToken(text, tokens, tokenIndex);
    if (trailingEndTokenIndex !== null) {
      const endToken = tokens[trailingEndTokenIndex];
      const originalClosingTagPosition = getOriginalClosingTagPosition(token, endToken);
      return {
        replacement: {
          start: token.start,
          end: endToken.end,
          text: appendExplicitClosingTag(serializedStartTag, token.tagName, rule, originalClosingTagPosition)
        },
        consumedTokenIndexes: [tokenIndex, trailingEndTokenIndex]
      };
    }

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
    const originalClosingTagPosition = getOriginalClosingTagPosition(token, endToken);
    const explicitTagText = appendExplicitClosingTag(serializedStartTag, token.tagName, rule, originalClosingTagPosition);
    const multilineExplicit = /\n/.test(serializedStartTag);

    if (between.trim().length === 0) {
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
      text: shouldMoveContentAfterNewLineClosingBracket(serializedStartTag, token, tokens, text)
        ? `${serializedStartTag}\n`
        : serializedStartTag
    },
    consumedTokenIndexes: [tokenIndex]
  };
}

/**
 * @param {string} serializedStartTag
 * @param {import("../parser/html-tokenizer").TagToken} token
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {string} text
 * @returns {boolean}
 */
function shouldMoveContentAfterNewLineClosingBracket(serializedStartTag, token, tokens, text) {
  if (!serializedStartTag.endsWith("\n>") || token.pairIndex === null) {
    return false;
  }

  const endToken = tokens[token.pairIndex];
  const between = text.slice(token.end, endToken.start);
  return between.trim().length > 0 && !between.startsWith("\n");
}

/**
 * @param {import("../parser/html-tokenizer").TagToken} startToken
 * @param {import("../parser/html-tokenizer").TagToken} endToken
 * @returns {"same-line" | "next-line"}
 */
function getOriginalClosingTagPosition(startToken, endToken) {
  return endToken.startLine > startToken.endLine ? "next-line" : "same-line";
}

/**
 * @param {string} text
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {number} tokenIndex
 * @param {string} serializedStartTag
 * @param {{firstLineAttributes: import("../parser/html-tokenizer").AttributeToken[], remainingAttributes: import("../parser/html-tokenizer").AttributeToken[]}} arrangedAttributes
 * @param {object} rule
 * @param {{debug(message: string): void, warn(message: string): void}} logger
 * @returns {{replacement: {start: number, end: number, text: string}, consumedTokenIndexes: number[]}}
 */
function buildSelfClosingReplacement(text, tokens, tokenIndex, serializedStartTag, arrangedAttributes, rule, logger) {
  const token = tokens[tokenIndex];
  const trailingEndTokenIndex = findTrailingExplicitEndToken(text, tokens, tokenIndex);

  if (trailingEndTokenIndex !== null) {
    const endToken = tokens[trailingEndTokenIndex];
    return {
      replacement: {
        start: token.start,
        end: endToken.end,
        text: serializedStartTag
      },
      consumedTokenIndexes: [tokenIndex, trailingEndTokenIndex]
    };
  }

  if (token.pairIndex !== null) {
    const endToken = tokens[token.pairIndex];
    const between = text.slice(token.end, endToken.start);
    if (between.trim().length > 0) {
      logger.warn(`Skipped self-closing conversion for <${token.tagName}> because it contains content.`);
      return {
        replacement: {
          start: token.start,
          end: token.end,
          text: serializeStartTag(
            token.tagName,
            arrangedAttributes.firstLineAttributes,
            arrangedAttributes.remainingAttributes,
            "explicit",
            rule,
            token.raw
          )
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

/**
 * Finds an explicit closing token that immediately trails a start token which
 * the tokenizer classified as self-closing, such as a void element written as
 * `<input></input>`.
 *
 * @param {string} text
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {number} tokenIndex
 * @returns {number | null}
 */
function findTrailingExplicitEndToken(text, tokens, tokenIndex) {
  const token = tokens[tokenIndex];

  for (let index = tokenIndex + 1; index < tokens.length; index += 1) {
    const candidate = tokens[index];
    if (candidate.kind === "comment" || candidate.kind === "declaration") {
      return null;
    }

    if (candidate.kind !== "end") {
      return null;
    }

    if (candidate.tagName !== token.tagName) {
      return null;
    }

    const between = text.slice(token.end, candidate.start);
    return between.trim().length === 0 ? index : null;
  }

  return null;
}

module.exports = {
  applyKnownTagRules
};
