"use strict";

/**
 * @param {import("../parser/html-tokenizer").AttributeToken[]} attributes
 * @param {object} rule
 * @returns {import("../parser/html-tokenizer").AttributeToken[]}
 */
function sortAttributes(attributes, rule) {
  if (!attributes.length) {
    return attributes.slice();
  }

  const matched = [];
  const unmatched = [];
  const consumed = new Set();

  for (let index = 0; index < rule.attributeOrder.length; index += 1) {
    const orderEntry = rule.attributeOrder[index];
    for (const attribute of attributes) {
      if (consumed.has(attribute.order)) {
        continue;
      }

      if (matchesAttribute(attribute, orderEntry)) {
        matched.push(attribute);
        consumed.add(attribute.order);
      }
    }
  }

  for (const attribute of attributes) {
    if (!consumed.has(attribute.order)) {
      unmatched.push(attribute);
    }
  }

  if (rule.sortUnknownAttributes === "alphabetical") {
    unmatched.sort((left, right) => left.baseName.localeCompare(right.baseName) || left.order - right.order);
  }

  if (rule.unknownAttributesPosition === "first") {
    return unmatched.concat(matched);
  }

  return matched.concat(unmatched);
}

/**
 * @param {import("../parser/html-tokenizer").AttributeToken[]} attributes
 * @param {object} rule
 * @returns {{firstLineAttributes: import("../parser/html-tokenizer").AttributeToken[], remainingAttributes: import("../parser/html-tokenizer").AttributeToken[]}}
 */
function arrangeAttributes(attributes, rule) {
  if (!attributes.length) {
    return {
      firstLineAttributes: [],
      remainingAttributes: []
    };
  }

  const firstLineAttributes = [];
  const consumed = new Set();
  const firstLineRules = Array.isArray(rule.firstLineAttributes) ? rule.firstLineAttributes : [];

  for (const firstLineRule of firstLineRules) {
    for (const attribute of attributes) {
      if (consumed.has(attribute.order)) {
        continue;
      }

      if (matchesAttribute(attribute, firstLineRule)) {
        firstLineAttributes.push(attribute);
        consumed.add(attribute.order);
      }
    }
  }

  return {
    firstLineAttributes,
    remainingAttributes: sortAttributes(
      attributes.filter((attribute) => !consumed.has(attribute.order)),
      rule
    )
  };
}

/**
 * @param {import("../parser/html-tokenizer").AttributeToken} attribute
 * @param {{name?: string, pattern?: string, flags?: string, kinds: string[] | null}} orderEntry
 * @returns {boolean}
 */
function matchesAttribute(attribute, orderEntry) {
  if (!orderEntry) {
    return false;
  }

  if (orderEntry.kinds && !orderEntry.kinds.includes(attribute.kind)) {
    return false;
  }

  if (typeof orderEntry.name === "string") {
    return attribute.baseName === orderEntry.name || attribute.name === orderEntry.name;
  }

  if (typeof orderEntry.pattern === "string") {
    const regex = new RegExp(orderEntry.pattern, orderEntry.flags || "");
    return matchesRegex(regex, attribute.baseName) || matchesRegex(regex, attribute.name);
  }

  return false;
}

/**
 * @param {RegExp} regex
 * @param {string} value
 * @returns {boolean}
 */
function matchesRegex(regex, value) {
  regex.lastIndex = 0;
  return regex.test(value);
}

module.exports = {
  arrangeAttributes,
  matchesAttribute,
  sortAttributes
};
