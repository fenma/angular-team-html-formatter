"use strict";

const { isVoidTag } = require("../html/void-tags");

/**
 * @param {string} text
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {number} tokenIndex
 * @param {object} rule
 * @returns {"self-closing" | "explicit"}
 */
function resolveClosingStyle(text, tokens, tokenIndex, rule) {
  const token = tokens[tokenIndex];

  if (isVoidTag(token.tagName)) {
    return "self-closing";
  }

  if (rule.closingStyle === "self-closing") {
    if (token.pairIndex !== null) {
      const endToken = tokens[token.pairIndex];
      const between = text.slice(token.end, endToken.start);
      if (between.trim().length === 0) {
        return "self-closing";
      }
      return "explicit";
    }

    return "self-closing";
  }

  if (rule.closingStyle === "explicit") {
    return "explicit";
  }

  return token.selfClosing ? "self-closing" : "explicit";
}

/**
 * @param {string} tagName
 * @param {import("../parser/html-tokenizer").AttributeToken[]} firstLineAttributes
 * @param {import("../parser/html-tokenizer").AttributeToken[]} remainingAttributes
 * @param {"self-closing" | "explicit"} closingStyle
 * @param {object} rule
 * @param {string} originalRaw
 * @returns {string}
 */
function serializeStartTag(tagName, firstLineAttributes, remainingAttributes, closingStyle, rule, originalRaw) {
  const allAttributes = firstLineAttributes.concat(remainingAttributes);
  const closingBracketPosition = resolveClosingBracketPosition(rule, originalRaw);
  const startTagLine = buildStartTagLine(tagName, firstLineAttributes);

  if (!allAttributes.length) {
    if (closingStyle === "self-closing") {
      return `<${tagName} />`;
    }
    return `<${tagName}>`;
  }

  if (rule.attributeLayout === "single-line") {
    const wrappedLines = buildWrappedAttributeLines(startTagLine, remainingAttributes, rule.maxAttributeLineWidth);
    if (wrappedLines.length === 1 && closingBracketPosition !== "next-line") {
      const suffix = closingStyle === "self-closing" ? " />" : ">";
      return `${wrappedLines[0]}${suffix}`;
    }

    return finalizeMultilineStartTag(wrappedLines, closingStyle, closingBracketPosition);
  }

  const prefersMultiline =
    rule.attributeLayout === "multi-line" || /\n/.test(originalRaw) || closingBracketPosition === "next-line";

  if (!prefersMultiline) {
    const suffix = closingStyle === "self-closing" ? " />" : ">";
    return `${buildStartTagLine(tagName, allAttributes)}${suffix}`;
  }

  const lines = buildMultilineTagLines(tagName, firstLineAttributes, remainingAttributes, originalRaw, rule);
  return finalizeMultilineStartTag(lines, closingStyle, closingBracketPosition);
}

/**
 * @param {string} tagName
 * @param {import("../parser/html-tokenizer").AttributeToken[]} attributes
 * @returns {string}
 */
function buildStartTagLine(tagName, attributes) {
  if (!attributes.length) {
    return `<${tagName}`;
  }

  return `<${tagName} ${attributes.map((attribute) => attribute.raw).join(" ")}`;
}

/**
 * @param {string[]} lines
 * @param {"self-closing" | "explicit"} closingStyle
 * @param {"same-line" | "next-line"} closingBracketPosition
 * @returns {string}
 */
function finalizeMultilineStartTag(lines, closingStyle, closingBracketPosition) {
  if (closingStyle === "explicit") {
    if (closingBracketPosition === "same-line") {
      lines[lines.length - 1] = `${lines[lines.length - 1]}>`;
    } else {
      lines.push(">");
    }
  } else if (closingBracketPosition === "next-line") {
    lines.push("/>");
  } else {
    lines[lines.length - 1] = `${lines[lines.length - 1]} />`;
  }

  return lines.join("\n");
}

/**
 * @param {object} rule
 * @param {string} originalRaw
 * @returns {"same-line" | "next-line"}
 */
function resolveClosingBracketPosition(rule, originalRaw) {
  if (rule.closingBracketPosition === "same-line" || rule.closingBracketPosition === "next-line") {
    return rule.closingBracketPosition;
  }

  if (rule.closingBracketPosition === "preserve") {
    return /\/?\s*\n\s*\/?>$/.test(originalRaw) || /\n\s*>$/.test(originalRaw) ? "next-line" : "same-line";
  }

  return "same-line";
}

/**
 * @param {string} serializedStartTag
 * @param {string} tagName
 * @param {object} rule
 * @param {"same-line" | "next-line" | null} [originalClosingTagPosition]
 * @returns {string}
 */
function appendExplicitClosingTag(serializedStartTag, tagName, rule, originalClosingTagPosition = null) {
  const closingTag = `</${tagName}>`;
  const closingTagPosition = resolveExplicitClosingTagPosition(rule, originalClosingTagPosition);
  return closingTagPosition === "next-line" ? `${serializedStartTag}\n${closingTag}` : `${serializedStartTag}${closingTag}`;
}

/**
 * @param {object} rule
 * @param {"same-line" | "next-line" | null} [originalClosingTagPosition]
 * @returns {"same-line" | "next-line"}
 */
function resolveExplicitClosingTagPosition(rule, originalClosingTagPosition = null) {
  if (rule.closingTagPosition === "same-line" || rule.closingTagPosition === "next-line") {
    return rule.closingTagPosition;
  }

  if (rule.closingTagPosition === "preserve" && originalClosingTagPosition) {
    return originalClosingTagPosition;
  }

  return "same-line";
}

/**
 * Preserves the original multiline attribute grouping as much as possible.
 *
 * @param {string} tagName
 * @param {import("../parser/html-tokenizer").AttributeToken[]} firstLineAttributes
 * @param {import("../parser/html-tokenizer").AttributeToken[]} remainingAttributes
 * @param {string} originalRaw
 * @param {object} rule
 * @returns {string[]}
 */
function buildMultilineTagLines(tagName, firstLineAttributes, remainingAttributes, originalRaw, rule) {
  const startTagLine = buildStartTagLine(tagName, firstLineAttributes);

  if (rule.attributeLayout === "multi-line") {
    return [startTagLine, ...remainingAttributes.map((attribute) => attribute.raw)];
  }

  if (rule.attributeLayout === "single-line") {
    return buildWrappedAttributeLines(startTagLine, remainingAttributes, rule.maxAttributeLineWidth);
  }

  if (firstLineAttributes.length > 0) {
    return [startTagLine, ...remainingAttributes.map((attribute) => attribute.raw)];
  }

  const attributes = firstLineAttributes.concat(remainingAttributes);
  const groups = getOriginalAttributeLineGroups(attributes, originalRaw);
  const lines = [];
  let cursor = 0;

  if (groups.firstLineCount > 0) {
    const groupedFirstLineAttributes = attributes.slice(0, groups.firstLineCount).map((attribute) => attribute.raw);
    lines.push(`<${tagName} ${groupedFirstLineAttributes.join(" ")}`);
    cursor += groups.firstLineCount;
  } else {
    lines.push(`<${tagName}`);
  }

  const continuationCounts = groups.continuationCounts.length
    ? groups.continuationCounts
    : attributes.slice(cursor).map(() => 1);

  for (const count of continuationCounts) {
    if (cursor >= attributes.length) {
      break;
    }
    const lineAttributes = attributes.slice(cursor, cursor + count).map((attribute) => attribute.raw);
    lines.push(lineAttributes.join(" "));
    cursor += count;
  }

  if (cursor < attributes.length) {
    lines.push(attributes.slice(cursor).map((attribute) => attribute.raw).join(" "));
  }

  return lines;
}

/**
 * Packs as many attributes as possible on each line until the configured width
 * would be exceeded, then continues on the next line.
 *
 * @param {string} firstLine
 * @param {import("../parser/html-tokenizer").AttributeToken[]} attributes
 * @param {number | null | undefined} maxWidth
 * @returns {string[]}
 */
function buildWrappedAttributeLines(firstLine, attributes, maxWidth) {
  const lines = [firstLine];
  let lineIndex = 0;

  for (const attribute of attributes) {
    const separator = " ";
    const candidateLine = `${lines[lineIndex]}${separator}${attribute.raw}`;
    const shouldWrap =
      Number.isInteger(maxWidth) &&
      maxWidth > 0 &&
      candidateLine.length > maxWidth &&
      (lineIndex > 0 || lines[lineIndex] !== firstLine);

    if (shouldWrap) {
      lines.push(attribute.raw);
      lineIndex += 1;
      continue;
    }

    lines[lineIndex] = candidateLine;
  }

  return lines;
}

/**
 * @param {import("../parser/html-tokenizer").AttributeToken[]} attributes
 * @param {string} originalRaw
 * @returns {{firstLineCount: number, continuationCounts: number[]}}
 */
function getOriginalAttributeLineGroups(attributes, originalRaw) {
  if (!/\n/.test(originalRaw)) {
    return {
      firstLineCount: 0,
      continuationCounts: []
    };
  }

  const countsByLine = new Map();
  for (const attribute of attributes) {
    countsByLine.set(attribute.line, (countsByLine.get(attribute.line) || 0) + 1);
  }

  const firstLineCount = countsByLine.get(0) || 0;
  const continuationCounts = Array.from(countsByLine.entries())
    .filter(([line]) => line > 0)
    .sort((left, right) => left[0] - right[0])
    .map(([, count]) => count);

  return {
    firstLineCount,
    continuationCounts
  };
}

module.exports = {
  appendExplicitClosingTag,
  resolveClosingStyle,
  serializeStartTag
};
