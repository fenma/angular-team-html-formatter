"use strict";

const { isVoidTag } = require("../html/void-tags");

/**
 * @typedef {object} AttributeToken
 * @property {string} raw
 * @property {string} name
 * @property {string} baseName
 * @property {"plain" | "property" | "event" | "two-way" | "structural" | "template-ref"} kind
 * @property {number} order
 * @property {number} line
 */

/**
 * @typedef {object} TagToken
 * @property {"start" | "end" | "comment" | "declaration"} kind
 * @property {string} raw
 * @property {string | null} tagName
 * @property {number} start
 * @property {number} end
 * @property {number} startLine
 * @property {number} endLine
 * @property {boolean} selfClosing
 * @property {AttributeToken[]} attributes
 * @property {number | null} pairIndex
 * @property {number} levelBefore
 */

/**
 * @param {string} text
 * @returns {TagToken[]}
 */
function tokenizeHtml(text) {
  const lineStarts = getLineStarts(text);
  const tokens = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char !== "<") {
      index += 1;
      continue;
    }

    if (text.startsWith("<!--", index)) {
      const end = text.indexOf("-->", index + 4);
      const tokenEnd = end === -1 ? text.length : end + 3;
      tokens.push(createToken("comment", text.slice(index, tokenEnd), null, index, tokenEnd, lineStarts));
      index = tokenEnd;
      continue;
    }

    if (text.startsWith("</", index)) {
      const tokenEnd = findTagEnd(text, index + 2);
      if (tokenEnd === -1) {
        break;
      }

      const raw = text.slice(index, tokenEnd + 1);
      const match = /^<\/\s*([^\s/>]+)/.exec(raw);
      const tagName = match ? match[1].toLowerCase() : null;
      tokens.push(createToken("end", raw, tagName, index, tokenEnd + 1, lineStarts));
      index = tokenEnd + 1;
      continue;
    }

    if (text.startsWith("<!", index)) {
      const tokenEnd = findTagEnd(text, index + 2);
      if (tokenEnd === -1) {
        break;
      }

      const raw = text.slice(index, tokenEnd + 1);
      tokens.push(createToken("declaration", raw, null, index, tokenEnd + 1, lineStarts));
      index = tokenEnd + 1;
      continue;
    }

    const next = text[index + 1];
    if (!next || !/[A-Za-z]/.test(next)) {
      index += 1;
      continue;
    }

    const tokenEnd = findTagEnd(text, index + 1);
    if (tokenEnd === -1) {
      break;
    }

    const raw = text.slice(index, tokenEnd + 1);
    const match = /^<\s*([^\s/>]+)/.exec(raw);
    const tagName = match ? match[1].toLowerCase() : null;
    const selfClosing = /\/\s*>$/.test(raw) || isVoidTag(tagName);
    const attributes = parseAttributes(raw);
    tokens.push(createToken("start", raw, tagName, index, tokenEnd + 1, lineStarts, selfClosing, attributes));
    index = tokenEnd + 1;
  }

  pairTokens(tokens);
  annotateLevels(tokens);
  return tokens;
}

/**
 * @param {string} rawTag
 * @returns {AttributeToken[]}
 */
function parseAttributes(rawTag) {
  const content = rawTag
    .replace(/^<\s*[^\s/>]+/, "")
    .replace(/\/?\s*>$/, "");
  const attributes = [];
  let index = 0;
  let order = 0;
  let line = 0;

  while (index < content.length) {
    while (index < content.length && /\s/.test(content[index])) {
      if (content[index] === "\n") {
        line += 1;
      }
      index += 1;
    }

    if (index >= content.length) {
      break;
    }

    const attrStart = index;
    while (index < content.length && !/[\s=>]/.test(content[index])) {
      index += 1;
    }

    const name = content.slice(attrStart, index);

    while (index < content.length && /\s/.test(content[index])) {
      index += 1;
    }

    if (content[index] === "=") {
      index += 1;

      while (index < content.length && /\s/.test(content[index])) {
        index += 1;
      }

      if (content[index] === "\"" || content[index] === "'") {
        const quote = content[index];
        index += 1;
        while (index < content.length) {
          if (content[index] === quote && content[index - 1] !== "\\") {
            index += 1;
            break;
          }
          index += 1;
        }
      } else {
        while (index < content.length && !/\s/.test(content[index])) {
          index += 1;
        }
      }
    }

    const raw = content.slice(attrStart, index).trimEnd();
    attributes.push({
      raw,
      name,
      ...classifyAttribute(name),
      order,
      line
    });
    order += 1;
  }

  return attributes;
}

/**
 * @param {TagToken[]} tokens
 * @returns {void}
 */
function pairTokens(tokens) {
  const stack = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    token.pairIndex = null;

    if (token.kind === "start" && token.tagName && !token.selfClosing) {
      stack.push(index);
      continue;
    }

    if (token.kind !== "end" || !token.tagName) {
      continue;
    }

    for (let cursor = stack.length - 1; cursor >= 0; cursor -= 1) {
      const candidateIndex = stack[cursor];
      const candidate = tokens[candidateIndex];
      if (candidate.tagName === token.tagName) {
        candidate.pairIndex = index;
        token.pairIndex = candidateIndex;
        stack.splice(cursor, 1);
        break;
      }
    }
  }
}

/**
 * @param {TagToken[]} tokens
 * @returns {void}
 */
function annotateLevels(tokens) {
  const stack = [];

  for (const token of tokens) {
    if (token.kind === "end") {
      let level = stack.length;
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index] === token.tagName) {
          level = index;
          stack.splice(index, 1);
          break;
        }
      }
      token.levelBefore = Math.max(level, 0);
      continue;
    }

    token.levelBefore = stack.length;

    if (token.kind === "start" && token.tagName && !token.selfClosing) {
      stack.push(token.tagName);
    }
  }
}

/**
 * @param {string} name
 * @returns {{baseName: string, kind: "plain" | "property" | "event" | "two-way" | "structural" | "template-ref"}}
 */
function classifyAttribute(name) {
  if (/^\[\(.+\)\]$/.test(name)) {
    return {
      baseName: name.slice(2, -2),
      kind: "two-way"
    };
  }

  if (/^\[.+\]$/.test(name)) {
    return {
      baseName: name.slice(1, -1),
      kind: "property"
    };
  }

  if (/^\(.+\)$/.test(name)) {
    return {
      baseName: name.slice(1, -1),
      kind: "event"
    };
  }

  if (/^\*.+$/.test(name)) {
    return {
      baseName: name.slice(1),
      kind: "structural"
    };
  }

  if (/^#.+$/.test(name)) {
    return {
      baseName: name.slice(1),
      kind: "template-ref"
    };
  }

  return {
    baseName: name,
    kind: "plain"
  };
}

/**
 * @param {string} text
 * @param {number} startIndex
 * @returns {number}
 */
function findTagEnd(text, startIndex) {
  let quote = null;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (char === quote && text[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === ">") {
      return index;
    }
  }

  return -1;
}

/**
 * @param {"start" | "end" | "comment" | "declaration"} kind
 * @param {string} raw
 * @param {string | null} tagName
 * @param {number} start
 * @param {number} end
 * @param {number[]} lineStarts
 * @param {boolean} [selfClosing]
 * @param {AttributeToken[]} [attributes]
 * @returns {TagToken}
 */
function createToken(kind, raw, tagName, start, end, lineStarts, selfClosing = false, attributes = []) {
  return {
    kind,
    raw,
    tagName,
    start,
    end,
    startLine: offsetToLine(lineStarts, start),
    endLine: offsetToLine(lineStarts, end - 1),
    selfClosing,
    attributes,
    pairIndex: null,
    levelBefore: 0
  };
}

/**
 * @param {string} text
 * @returns {number[]}
 */
function getLineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

/**
 * @param {number[]} lineStarts
 * @param {number} offset
 * @returns {number}
 */
function offsetToLine(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= offset && (mid === lineStarts.length - 1 || lineStarts[mid + 1] > offset)) {
      return mid;
    }

    if (lineStarts[mid] > offset) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return 0;
}

module.exports = {
  classifyAttribute,
  isVoidTag,
  parseAttributes,
  tokenizeHtml
};
