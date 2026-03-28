"use strict";

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
    return reindentHtml(workingText, config, options.initialIndentLevel || 0);
  } catch (error) {
    logger.warn(`Indentation failed, returning original text: ${error.message}`);
    return text;
  }
}

module.exports = {
  formatText,
  getIndentLevelAtEnd,
  reindentHtml
};
