"use strict";

/**
 * @param {string} text
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {number} tokenIndex
 * @param {object} rule
 * @returns {"self-closing" | "explicit"}
 */
function resolveClosingStyle(text, tokens, tokenIndex, rule) {
  const token = tokens[tokenIndex];

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
 * @param {import("../parser/html-tokenizer").AttributeToken[]} attributes
 * @param {"self-closing" | "explicit"} closingStyle
 * @param {object} rule
 * @param {string} originalRaw
 * @returns {string}
 */
function serializeStartTag(tagName, attributes, closingStyle, rule, originalRaw) {
  const attributeTexts = attributes.map((attribute) => attribute.raw);

  if (!attributeTexts.length) {
    if (closingStyle === "self-closing") {
      return `<${tagName} />`;
    }
    return `<${tagName}>`;
  }

  if (rule.attributeLayout === "single-line") {
    const wrappedLines = buildWrappedAttributeLines(tagName, attributes, rule.maxAttributeLineWidth);
    if (wrappedLines.length === 1 && rule.closingBracketPosition !== "new-line") {
      const suffix = closingStyle === "self-closing" ? " />" : ">";
      return `${wrappedLines[0]}${suffix}`;
    }

    return finalizeMultilineStartTag(wrappedLines, closingStyle, rule);
  }

  const prefersMultiline = rule.attributeLayout === "multi-line" || /\n/.test(originalRaw) || rule.closingBracketPosition === "new-line";

  if (!prefersMultiline) {
    const suffix = closingStyle === "self-closing" ? " />" : ">";
    return `<${tagName} ${attributeTexts.join(" ")}${suffix}`;
  }

  const lines = buildMultilineTagLines(tagName, attributes, originalRaw, rule);
  return finalizeMultilineStartTag(lines, closingStyle, rule);
}

/**
 * @param {string[]} lines
 * @param {"self-closing" | "explicit"} closingStyle
 * @param {object} rule
 * @returns {string}
 */
function finalizeMultilineStartTag(lines, closingStyle, rule) {
  if (closingStyle === "explicit") {
    if (rule.closingBracketPosition === "same-line") {
      lines[lines.length - 1] = `${lines[lines.length - 1]} >`;
    } else {
      lines.push(">");
    }
  } else if (rule.closingBracketPosition === "new-line") {
    lines.push("/>");
  } else {
    lines[lines.length - 1] = `${lines[lines.length - 1]} />`;
  }

  return lines.join("\n");
}

/**
 * @param {string} serializedStartTag
 * @param {string} tagName
 * @param {object} rule
 * @returns {string}
 */
function appendExplicitClosingTag(serializedStartTag, tagName, rule) {
  const closingTag = `</${tagName}>`;
  if (!/\n/.test(serializedStartTag)) {
    return `${serializedStartTag}${closingTag}`;
  }

  const closingTagPosition = resolveExplicitClosingTagPosition(rule);
  return closingTagPosition === "new-line"
    ? `${serializedStartTag}\n${closingTag}`
    : `${serializedStartTag}${closingTag}`;
}

/**
 * @param {object} rule
 * @returns {"same-line" | "new-line"}
 */
function resolveExplicitClosingTagPosition(rule) {
  if (rule.closingTagPosition === "same-line" || rule.closingTagPosition === "new-line") {
    return rule.closingTagPosition;
  }

  return "same-line";
}

/**
 * Preserves the original multiline attribute grouping as much as possible.
 *
 * @param {string} tagName
 * @param {import("../parser/html-tokenizer").AttributeToken[]} attributes
 * @param {string} originalRaw
 * @param {object} rule
 * @returns {string[]}
 */
function buildMultilineTagLines(tagName, attributes, originalRaw, rule) {
  if (rule.attributeLayout === "multi-line") {
    return [`<${tagName}`, ...attributes.map((attribute) => attribute.raw)];
  }

  if (rule.attributeLayout === "single-line") {
    return buildWrappedAttributeLines(tagName, attributes, rule.maxAttributeLineWidth);
  }

  const groups = getOriginalAttributeLineGroups(attributes, originalRaw);
  const lines = [];
  let cursor = 0;

  if (groups.firstLineCount > 0) {
    const firstLineAttributes = attributes.slice(0, groups.firstLineCount).map((attribute) => attribute.raw);
    lines.push(`<${tagName} ${firstLineAttributes.join(" ")}`);
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
 * @param {string} tagName
 * @param {import("../parser/html-tokenizer").AttributeToken[]} attributes
 * @param {number | null | undefined} maxWidth
 * @returns {string[]}
 */
function buildWrappedAttributeLines(tagName, attributes, maxWidth) {
  const lines = [`<${tagName}`];
  let lineIndex = 0;

  for (const attribute of attributes) {
    const separator = lineIndex === 0 && lines[lineIndex] === `<${tagName}` ? " " : " ";
    const candidateLine = `${lines[lineIndex]}${separator}${attribute.raw}`;
    const shouldWrap =
      Number.isInteger(maxWidth) &&
      maxWidth > 0 &&
      candidateLine.length > maxWidth &&
      (lineIndex > 0 || lines[lineIndex] !== `<${tagName}`);

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
