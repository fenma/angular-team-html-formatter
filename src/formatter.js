"use strict";

const { startsWithAngularBlock } = require("./angular/block-syntax");
const { tokenizeHtml } = require("./parser/html-tokenizer");
const { applyKnownTagRules } = require("./formatter/apply-known-tag-rules");
const { getIndentLevelAtEnd, reindentHtml } = require("./formatter/indentation");

/**
 * Public formatter entrypoint used by both document formatting and selection formatting.
 * The workflow is intentionally split into:
 * 1. tag-specific rewrites for configured tags only
 * 2. a final indentation pass across the resulting text
 *
 * @param {string} text
 * @param {object} config
 * @param {{debug(message: string): void, warn(message: string): void}} logger
 * @param {{initialIndentLevel?: number}} [options]
 * @returns {string}
 */
function formatText(text, config, logger, options = {}) {
  let workingText = text;

  try {
    const initialTokens = tokenizeHtml(text);
    workingText = applyKnownTagRules(text, initialTokens, config, logger);
  } catch (error) {
    logger.warn(`Tag formatting failed, continuing with indentation only: ${error.message}`);
  }

  try {
    const formattedText = reindentHtml(workingText, config, options.initialIndentLevel || 0);
    if (hasMeaningfulContentChange(text, formattedText)) {
      logger.warn("Formatting changed significant content, returning original text.");
      return text;
    }

    const textWhitespaceMode =
      config && config.contentSafety && typeof config.contentSafety.textWhitespace === "string"
        ? config.contentSafety.textWhitespace
        : "strict";

    if (textWhitespaceMode === "strict" && hasTextWhitespaceChange(text, formattedText)) {
      logger.warn("Formatting changed text-node whitespace, returning original text.");
      return text;
    }

    return formattedText;
  } catch (error) {
    logger.warn(`Indentation failed, returning original text: ${error.message}`);
    return text;
  }
}

/**
 * Protects against accidental content loss by comparing the sequence of
 * non-whitespace text nodes plus comment/declaration bodies before and after formatting.
 *
 * @param {string} originalText
 * @param {string} formattedText
 * @returns {boolean}
 */
function hasMeaningfulContentChange(originalText, formattedText) {
  const originalContent = extractSignificantContent(originalText);
  const formattedContent = extractSignificantContent(formattedText);

  if (originalContent.length !== formattedContent.length) {
    return true;
  }

  for (let index = 0; index < originalContent.length; index += 1) {
    const left = originalContent[index];
    const right = formattedContent[index];
    if (left.kind !== right.kind || left.value !== right.value) {
      return true;
    }
  }

  return false;
}

/**
 * @param {string} text
 * @returns {{kind: "text" | "comment" | "declaration", value: string}[]}
 */
function extractSignificantContent(text) {
  const tokens = tokenizeHtml(text);
  const content = [];
  let cursor = 0;

  for (const token of tokens) {
    const gap = text.slice(cursor, token.start);
    if (gap.trim().length > 0) {
      content.push({
        kind: "text",
        value: gap.trim()
      });
    }

    if (token.kind === "comment" || token.kind === "declaration") {
      content.push({
        kind: token.kind,
        value: token.raw
      });
    }

    cursor = token.end;
  }

  const tail = text.slice(cursor);
  if (tail.trim().length > 0) {
    content.push({
      kind: "text",
      value: tail.trim()
    });
  }

  return content;
}

/**
 * @param {string} originalText
 * @param {string} formattedText
 * @returns {boolean}
 */
function hasTextWhitespaceChange(originalText, formattedText) {
  const originalTextNodes = extractMeaningfulTextNodes(originalText);
  const formattedTextNodes = extractMeaningfulTextNodes(formattedText);

  if (originalTextNodes.length !== formattedTextNodes.length) {
    return true;
  }

  for (let index = 0; index < originalTextNodes.length; index += 1) {
    if (originalTextNodes[index] !== formattedTextNodes[index]) {
      return true;
    }
  }

  return false;
}

/**
 * Returns raw text-node slices that contain non-whitespace characters.
 * Pure indentation-only gaps between tags are ignored.
 *
 * @param {string} text
 * @returns {string[]}
 */
function extractMeaningfulTextNodes(text) {
  const tokens = tokenizeHtml(text);
  const textNodes = [];
  let cursor = 0;

  for (const token of tokens) {
    const gap = text.slice(cursor, token.start);
    if (shouldProtectTextNodeWhitespace(gap)) {
      textNodes.push(gap);
    }
    cursor = token.end;
  }

  const tail = text.slice(cursor);
  if (shouldProtectTextNodeWhitespace(tail)) {
    textNodes.push(tail);
  }

  return textNodes;
}

/**
 * @param {string} gap
 * @returns {boolean}
 */
function shouldProtectTextNodeWhitespace(gap) {
  if (gap.trim().length === 0) {
    return false;
  }

  return !isAngularControlFlowGap(gap);
}

/**
 * Angular control-flow syntax such as `@if (...) {` and `} @else {` is not
 * user-facing text content, so strict text-node protection should ignore it.
 *
 * @param {string} gap
 * @returns {boolean}
 */
function isAngularControlFlowGap(gap) {
  const lines = gap
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return false;
  }

  return lines.every((line) => {
    const withoutLeadingBraces = line.replace(/^\}+\s*/, "");
    if (!withoutLeadingBraces) {
      return true;
    }

    return startsWithAngularBlock(withoutLeadingBraces);
  });
}

module.exports = {
  extractMeaningfulTextNodes,
  extractSignificantContent,
  formatText,
  getIndentLevelAtEnd,
  hasMeaningfulContentChange,
  hasTextWhitespaceChange,
  reindentHtml
};
