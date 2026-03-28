"use strict";

const DEFAULT_CONFIG = {
  configFileNames: [
    "html-formatter.config.jsonc",
    "html-formatter.config.json",
    ".angular-html-format.json",
    ".team-html-format.json"
  ],
  indent: {
    size: 2,
    useTabs: false
  },
  defaultBehavior: {
    unknownTags: "indent-only"
  },
  knownTagDefaults: {
    attributeOrder: [],
    unknownAttributesPosition: "bottom",
    sortUnknownAttributes: "preserve",
    closingStyle: "preserve",
    closingBracketPosition: "preserve",
    closingTagPosition: "preserve"
  },
  tags: {}
};

module.exports = {
  DEFAULT_CONFIG
};
