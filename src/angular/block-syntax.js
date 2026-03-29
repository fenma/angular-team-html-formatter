"use strict";

const ANGULAR_BLOCK_PATTERN = /^@(if|else(\s+if)?|for|switch|case|default|defer|placeholder|loading|error|empty)\b/;

/**
 * @param {string} text
 * @returns {boolean}
 */
function startsWithAngularBlock(text) {
  return ANGULAR_BLOCK_PATTERN.test(text);
}

module.exports = {
  ANGULAR_BLOCK_PATTERN,
  startsWithAngularBlock
};
