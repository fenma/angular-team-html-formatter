"use strict";

const { isStandardHtmlTag } = require("./standard-html-tags");

/**
 * @param {string} tagName
 * @param {string} settingName
 * @param {unknown} value
 * @returns {{normalizeMessage: string, diagnosticMessage: string} | null}
 */
function getTagSettingConstraint(tagName, settingName, value) {
  const normalizedTagName = String(tagName || "").toLowerCase();
  if (
    settingName === "closingStyle" &&
    isStandardHtmlTag(normalizedTagName)
  ) {
    return {
      normalizeMessage: `Ignoring closingStyle on tag "${normalizedTagName}". Standard HTML tags cannot use closingStyle.`,
      diagnosticMessage: `Tag "${normalizedTagName}" cannot use "closingStyle". Standard HTML tags cannot use closingStyle.`
    };
  }

  return null;
}

module.exports = {
  getTagSettingConstraint
};
