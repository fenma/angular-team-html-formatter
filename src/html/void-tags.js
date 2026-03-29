"use strict";

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

/**
 * @param {string | null | undefined} tagName
 * @returns {boolean}
 */
function isVoidTag(tagName) {
  return Boolean(tagName && VOID_TAGS.has(tagName));
}

module.exports = {
  isVoidTag,
  VOID_TAGS
};
