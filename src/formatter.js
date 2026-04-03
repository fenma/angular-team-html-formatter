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
    workingText = normalizeTextNodeInterpolations(workingText);
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
    if (shouldTrackSignificantTextContent(gap)) {
      content.push({
        kind: "text",
        value: normalizeInterpolationWhitespaceInText(gap).trim()
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
  if (shouldTrackSignificantTextContent(tail)) {
    content.push({
      kind: "text",
      value: normalizeInterpolationWhitespaceInText(tail).trim()
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
  const originalTextNodes = extractMeaningfulTextNodes(originalText).map(serializeTextNodeWhitespaceSemantics);
  const formattedTextNodes = extractMeaningfulTextNodes(formattedText).map(serializeTextNodeWhitespaceSemantics);

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
 * @returns {{text: string, preserveWhitespace: boolean}[]}
 */
function extractMeaningfulTextNodes(text) {
  const tokens = tokenizeHtml(text);
  const textNodes = [];
  let cursor = 0;
  const openTagStack = [];

  for (const token of tokens) {
    const gap = text.slice(cursor, token.start);
    if (shouldProtectTextNodeWhitespace(gap)) {
      textNodes.push({
        text: gap,
        preserveWhitespace: isWhitespacePreservingContext(openTagStack)
      });
    }

    updateOpenTagStack(openTagStack, token);
    cursor = token.end;
  }

  const tail = text.slice(cursor);
  if (shouldProtectTextNodeWhitespace(tail)) {
    textNodes.push({
      text: tail,
      preserveWhitespace: isWhitespacePreservingContext(openTagStack)
    });
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
 * Significant-content protection should track only user-facing text content,
 * not structural Angular block syntax that happens to live between HTML tags.
 *
 * @param {string} gap
 * @returns {boolean}
 */
function shouldTrackSignificantTextContent(gap) {
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

/**
 * @param {string[]} openTagStack
 * @param {import("./parser/html-tokenizer").TagToken} token
 * @returns {void}
 */
function updateOpenTagStack(openTagStack, token) {
  if (token.kind === "start" && token.tagName && !token.selfClosing) {
    openTagStack.push(token.tagName);
    return;
  }

  if (token.kind !== "end" || !token.tagName) {
    return;
  }

  for (let index = openTagStack.length - 1; index >= 0; index -= 1) {
    if (openTagStack[index] === token.tagName) {
      openTagStack.splice(index, 1);
      return;
    }
  }
}

/**
 * @param {string[]} openTagStack
 * @returns {boolean}
 */
function isWhitespacePreservingContext(openTagStack) {
  return openTagStack.some((tagName) => WHITESPACE_PRESERVING_TAGS.has(tagName));
}

/**
 * @param {{text: string, preserveWhitespace: boolean}} textNode
 * @returns {string}
 */
function serializeTextNodeWhitespaceSemantics(textNode) {
  const normalizedText = normalizeInterpolationWhitespaceInText(textNode.text);
  if (textNode.preserveWhitespace) {
    return `preserve:${normalizedText}`;
  }

  return `collapse:${serializeCollapsedWhitespaceSemantics(normalizedText)}`;
}

/**
 * In normal HTML text, browsers collapse whitespace. For safety checks we care
 * about semantic whitespace, not indentation depth.
 *
 * @param {string} text
 * @returns {string}
 */
function serializeCollapsedWhitespaceSemantics(text) {
  const hasLeadingWhitespace = /^\s/.test(text);
  const hasTrailingWhitespace = /\s$/.test(text);
  const collapsedCore = text.replace(/\s+/g, " ").trim();
  return `${hasLeadingWhitespace ? "lead" : "nolead"}|${collapsedCore}|${hasTrailingWhitespace ? "trail" : "notrail"}`;
}

/**
 * Normalizes Angular interpolation formatting in text nodes without touching tag
 * syntax, attribute values, comments, or declarations.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeTextNodeInterpolations(text) {
  const tokens = tokenizeHtml(text);
  let output = "";
  let cursor = 0;

  for (const token of tokens) {
    output += normalizeInterpolationWhitespaceInText(text.slice(cursor, token.start));
    output += token.raw;
    cursor = token.end;
  }

  output += normalizeInterpolationWhitespaceInText(text.slice(cursor));
  return output;
}

/**
 * Applies lightweight Angular interpolation formatting:
 * - exactly one space inside `{{` and `}}`
 * - exactly one space around top-level pipe operators
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeInterpolationWhitespaceInText(text) {
  return text.replace(/{{([\s\S]*?)}}/g, (_match, expression) => `{{ ${normalizeAngularExpression(expression)} }}`);
}

/**
 * @param {string} expression
 * @returns {string}
 */
function normalizeAngularExpression(expression) {
  const compact = collapseWhitespace(expression).trim();
  return normalizePipeWhitespace(compact);
}

/**
 * @param {string} value
 * @returns {string}
 */
function collapseWhitespace(value) {
  let output = "";
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (quote) {
      output += char;
      if (char === quote && value[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      output += char;
      continue;
    }

    if (/\s/.test(char)) {
      if (!output.endsWith(" ")) {
        output += " ";
      }
      continue;
    }

    output += char;
  }

  return output;
}

/**
 * Adds single spaces around top-level Angular pipes while leaving logical OR,
 * quoted strings, and nested groups untouched.
 *
 * @param {string} expression
 * @returns {string}
 */
function normalizePipeWhitespace(expression) {
  let output = "";
  let quote = null;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    const next = expression[index + 1];
    const prev = expression[index - 1];

    if (quote) {
      output += char;
      if (char === quote && prev !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      output += char;
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      output += char;
      continue;
    }

    if (char === ")" && parenDepth > 0) {
      parenDepth -= 1;
      output += char;
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      output += char;
      continue;
    }

    if (char === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
      output += char;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      output += char;
      continue;
    }

    if (char === "}" && braceDepth > 0) {
      braceDepth -= 1;
      output += char;
      continue;
    }

    if (
      char === "|" &&
      next !== "|" &&
      prev !== "|" &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      output = output.trimEnd();
      output += " | ";
      while (/\s/.test(expression[index + 1] || "")) {
        index += 1;
      }
      continue;
    }

    output += char;
  }

  return output.trim();
}

const WHITESPACE_PRESERVING_TAGS = new Set(["pre", "textarea"]);

module.exports = {
  extractMeaningfulTextNodes,
  extractSignificantContent,
  formatText,
  getIndentLevelAtEnd,
  hasMeaningfulContentChange,
  hasTextWhitespaceChange,
  normalizeAngularExpression,
  normalizeInterpolationWhitespaceInText,
  normalizeTextNodeInterpolations,
  reindentHtml
};
