"use strict";

/**
 * @param {string} tagName
 * @param {object} config
 * @returns {object | null}
 */
function getTagRule(tagName, config) {
  if (!tagName || !config || !config.tags) {
    return null;
  }

  const explicitRule = config.tags[tagName.toLowerCase()];
  if (!explicitRule) {
    return null;
  }

  return {
    ...config.knownTagDefaults,
    ...explicitRule
  };
}

module.exports = {
  getTagRule
};
