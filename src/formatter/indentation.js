"use strict";

const { startsWithAngularBlock } = require("../angular/block-syntax");
const { tokenizeHtml } = require("../parser/html-tokenizer");

/**
 * @param {string} text
 * @param {object} config
 * @param {number} [initialIndentLevel]
 * @returns {string}
 */
function reindentHtml(text, config, initialIndentLevel = 0) {
  const tokens = tokenizeHtml(text);
  const lines = text.split("\n");
  const tokensByStartLine = new Map();
  const multilineContinuations = new Map();
  const controlFlowInfos = lines.map((line) => getAngularControlFlowLineInfo(line));

  for (const token of tokens) {
    if (!tokensByStartLine.has(token.startLine)) {
      tokensByStartLine.set(token.startLine, []);
    }
    tokensByStartLine.get(token.startLine).push(token);

    if (token.kind === "start" && token.endLine > token.startLine) {
      for (let line = token.startLine + 1; line <= token.endLine; line += 1) {
        multilineContinuations.set(line, token);
      }
    }
  }

  let htmlLevel = 0;
  let controlFlowLevel = 0;
  const formattedLines = lines.map((line, lineIndex) => {
    if (!line.trim()) {
      return "";
    }

    const continuationToken = multilineContinuations.get(lineIndex);
    const startTokens = (tokensByStartLine.get(lineIndex) || []).slice().sort((left, right) => left.start - right.start);
    const firstToken = startTokens[0];
    const startsWithClosingTag = !!(
      firstToken &&
      firstToken.kind === "end" &&
      line.slice(0, line.search(/\S|$/)).trim() === ""
    );

    const controlFlowInfo = controlFlowInfos[lineIndex];
    const activeControlFlowLevel = Math.max(controlFlowLevel - controlFlowInfo.preDedent, 0);
    let indentLevel = initialIndentLevel + htmlLevel + activeControlFlowLevel;

    if (continuationToken && lineIndex > continuationToken.startLine) {
      indentLevel = isStandaloneClosingBracketLine(line)
        ? initialIndentLevel + continuationToken.levelBefore + activeControlFlowLevel
        : initialIndentLevel + continuationToken.levelBefore + activeControlFlowLevel + 1;
    } else if (startsWithClosingTag) {
      const { matchedCount, unmatchedCount } = countLeadingClosingTags(startTokens);
      indentLevel =
        Math.max(initialIndentLevel - unmatchedCount, 0) +
        Math.max(htmlLevel - matchedCount, 0) +
        activeControlFlowLevel;
    }

    const trimmed = line.trimStart();
    const indentedLine = `${buildIndent(indentLevel, config)}${trimmed}`;

    htmlLevel = computeHtmlLevelAfterLine(htmlLevel, tokens, lineIndex);
    controlFlowLevel = activeControlFlowLevel + controlFlowInfo.postNetDelta;
    return indentedLine;
  });

  return formattedLines.join("\n");
}

/**
 * @param {string} text
 * @returns {number}
 */
function getIndentLevelAtEnd(text) {
  const tokens = tokenizeHtml(text);
  const lines = text.split("\n");
  let htmlLevel = 0;
  let controlFlowLevel = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const controlFlowInfo = getAngularControlFlowLineInfo(lines[lineIndex]);
    const activeControlFlowLevel = Math.max(controlFlowLevel - controlFlowInfo.preDedent, 0);
    htmlLevel = computeHtmlLevelAfterLine(htmlLevel, tokens, lineIndex);
    controlFlowLevel = activeControlFlowLevel + controlFlowInfo.postNetDelta;
  }

  return Math.max(htmlLevel + controlFlowLevel, 0);
}

/**
 * @param {number} currentLevel
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} tokens
 * @param {number} lineIndex
 * @returns {number}
 */
function computeHtmlLevelAfterLine(currentLevel, tokens, lineIndex) {
  let level = currentLevel;

  for (const token of tokens) {
    if (token.kind === "start" && !token.selfClosing && token.endLine === lineIndex) {
      level += 1;
    }

    if (token.kind === "end" && token.startLine === lineIndex) {
      level = Math.max(level - 1, 0);
    }
  }

  return Math.max(level, 0);
}

/**
 * @param {string} line
 * @returns {{preDedent: number, postNetDelta: number}}
 */
function getAngularControlFlowLineInfo(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      preDedent: 0,
      postNetDelta: 0
    };
  }

  let preDedent = 0;
  let index = 0;

  while (trimmed[index] === "}") {
    preDedent += 1;
    index += 1;

    while (trimmed[index] === " " || trimmed[index] === "\t") {
      index += 1;
    }
  }

  const remaining = trimmed.slice(index);
  let openCount = 0;
  let closeCount = 0;

  if (startsWithAngularBlock || preDedent > 0) {
    ({ openCount, closeCount } = countAngularControlFlowBraces(remaining));
  }

  const nonLeadingCloseCount = Math.max(closeCount - preDedent, 0);

  return {
    preDedent,
    postNetDelta: openCount - nonLeadingCloseCount
  };
}

/**
 * @param {string} line
 * @returns {{openCount: number, closeCount: number}}
 */
function countAngularControlFlowBraces(line) {
  let openCount = 0;
  let closeCount = 0;
  let quote = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (quote) {
      if (char === quote && line[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{" && next === "{") {
      index += 1;
      continue;
    }

    if (char === "}" && next === "}") {
      index += 1;
      continue;
    }

    if (char === "{") {
      openCount += 1;
      continue;
    }

    if (char === "}") {
      closeCount += 1;
    }
  }

  return {
    openCount,
    closeCount
  };
}

/**
 * @param {ReturnType<import("../parser/html-tokenizer").tokenizeHtml>} startTokens
 * @returns {{matchedCount: number, unmatchedCount: number}}
 */
function countLeadingClosingTags(startTokens) {
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const token of startTokens) {
    if (token.kind !== "end") {
      break;
    }

    if (token.pairIndex === null) {
      unmatchedCount += 1;
    } else {
      matchedCount += 1;
    }
  }

  return {
    matchedCount,
    unmatchedCount
  };
}

/**
 * @param {number} level
 * @param {object} config
 * @returns {string}
 */
function buildIndent(level, config) {
  if (config.indent.useTabs) {
    return "\t".repeat(level);
  }

  return " ".repeat(level * config.indent.size);
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isStandaloneClosingBracketLine(line) {
  const trimmed = line.trim();
  return trimmed === ">" || trimmed === "/>" || /^><\/[^>]+>$/.test(trimmed);
}

module.exports = {
  getIndentLevelAtEnd,
  reindentHtml
};
