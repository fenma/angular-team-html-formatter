"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatText } = require("../src/formatter");
const { createConfig, createLogger } = require("../test-support/helpers");

const ATTRIBUTE_LAYOUTS = ["preserve", "multi-line", "single-line"];
const CLOSING_STYLES = ["self-closing", "explicit"];
const BRACKET_POSITIONS = ["same-line", "new-line"];
const CLOSING_TAG_POSITIONS = ["same-line", "new-line"];

function createTagRule(overrides = {}) {
  return {
    attributeOrder: ["class", "options"],
    ...overrides
  };
}

function createCombinationInput(attributeLayout) {
  if (attributeLayout === "single-line") {
    return "<p-select\n  class=\"w-full\"\n  [options]=\"items\"\n/>";
  }

  return "<p-select class=\"w-full\" [options]=\"items\" />";
}

function createExpectedOutput(attributeLayout, closingStyle, closingBracketPosition, closingTagPosition) {
  const inlineStartTag = "<p-select class=\"w-full\" [options]=\"items\"";
  const multilineStartTag = "<p-select\n  class=\"w-full\"\n  [options]=\"items\"";

  if (attributeLayout === "single-line") {
    if (closingBracketPosition === "same-line") {
      return closingStyle === "self-closing"
        ? `${inlineStartTag} />`
        : closingTagPosition === "new-line"
          ? `${inlineStartTag}>\n</p-select>`
          : `${inlineStartTag}></p-select>`;
    }

    return closingStyle === "self-closing"
      ? `${inlineStartTag}\n/>`
      : closingTagPosition === "new-line"
        ? `${inlineStartTag}\n>\n</p-select>`
        : `${inlineStartTag}\n></p-select>`;
  }

  if (attributeLayout === "preserve" && closingBracketPosition === "same-line") {
    return closingStyle === "self-closing"
      ? `${inlineStartTag} />`
      : closingTagPosition === "new-line"
        ? `${inlineStartTag}>\n</p-select>`
        : `${inlineStartTag}></p-select>`;
  }

  if (closingBracketPosition === "same-line") {
    return closingStyle === "self-closing"
      ? `${multilineStartTag} />`
      : closingTagPosition === "new-line"
        ? `${multilineStartTag}>\n</p-select>`
        : `${multilineStartTag}></p-select>`;
  }

  return closingStyle === "self-closing"
    ? `${multilineStartTag}\n/>`
    : closingTagPosition === "new-line"
      ? `${multilineStartTag}\n>\n</p-select>`
      : `${multilineStartTag}\n></p-select>`;
}

for (const attributeLayout of ATTRIBUTE_LAYOUTS) {
  for (const closingStyle of CLOSING_STYLES) {
    for (const closingBracketPosition of BRACKET_POSITIONS) {
      for (const closingTagPosition of CLOSING_TAG_POSITIONS) {
        test(
          `combination: attributeLayout=${attributeLayout}, closingStyle=${closingStyle}, closingBracketPosition=${closingBracketPosition}, closingTagPosition=${closingTagPosition}`,
          () => {
            const input = createCombinationInput(attributeLayout);
            const config = createConfig({
              tags: {
                "p-select": createTagRule({
                  attributeLayout,
                  closingStyle,
                  closingBracketPosition,
                  closingTagPosition
                })
              }
            });

            const output = formatText(input, config, createLogger());
            assert.equal(
              output,
              createExpectedOutput(attributeLayout, closingStyle, closingBracketPosition, closingTagPosition)
            );
          }
        );
      }
    }
  }
}

test("attributeLayout preserve keeps single-line known tags on one line", () => {
  const input = "<p-select class=\"w-full\" inputId=\"order\" [options]=\"items\" />";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class", "options"],
        attributeLayout: "preserve",
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select inputId=\"order\" class=\"w-full\" [options]=\"items\" />");
});

test("knownTagDefaults attributeLayout multi-line puts known tag attributes on separate lines", () => {
  const input = "<p-select class=\"w-full\" inputId=\"order\" [options]=\"items\" />";
  const config = createConfig({
    knownTagDefaults: {
      attributeLayout: "multi-line",
      closingStyle: "self-closing"
    },
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class", "options"]
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  inputId=\"order\"\n  class=\"w-full\"\n  [options]=\"items\" />");
});

test("attributeLayout single-line wraps once maxAttributeLineWidth would be exceeded", () => {
  const input =
    "<p-select class=\"w-full\" inputId=\"order\" [options]=\"items\" [placeholder]=\"label\" [showClear]=\"true\" />";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class", "options", "placeholder", "showClear"],
        attributeLayout: "single-line",
        maxAttributeLineWidth: 45,
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<p-select inputId=\"order\" class=\"w-full\"\n  [options]=\"items\" [placeholder]=\"label\"\n  [showClear]=\"true\" />"
  );
});

test("tag attributeLayout preserve can override multi-line known tag defaults", () => {
  const input = "<p-select class=\"w-full\" inputId=\"order\" [options]=\"items\" />";
  const config = createConfig({
    knownTagDefaults: {
      attributeLayout: "multi-line",
      closingStyle: "self-closing"
    },
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class", "options"],
        attributeLayout: "preserve"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select inputId=\"order\" class=\"w-full\" [options]=\"items\" />");
});

test("knownTagDefaults can drive explicit new-line closing tag formatting", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n/>";
  const config = createConfig({
    knownTagDefaults: {
      closingStyle: "explicit",
      closingBracketPosition: "new-line",
      closingTagPosition: "new-line"
    },
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"]
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n>\n</p-select>");
});

test("single-line explicit same-line bracket with new-line closing tag puts the end tag on the next line", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"items\"\n/>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "new-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select class=\"w-full\" [options]=\"items\">\n</p-select>");
});

test("single-line explicit new-line bracket with new-line closing tag keeps both on their own lines", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"items\"\n/>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "new-line",
        closingTagPosition: "new-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select class=\"w-full\" [options]=\"items\"\n>\n</p-select>");
});

test("tag-specific closingTagPosition overrides global default", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n/>";
  const config = createConfig({
    knownTagDefaults: {
      closingStyle: "explicit",
      closingBracketPosition: "same-line",
      closingTagPosition: "new-line"
    },
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        closingTagPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\"\n  [options]=\"name\"></p-select>");
});

test("existing explicit tags honor same-line bracket and new-line closing tag", () => {
  const input =
    "<p-select\n  class=\"w-full\"\n  [options]=\"transportModeData\"\n  [placeholder]=\"dropdownPlaceholder\"\n  [showClear]=\"true\"\n  optionLabel=\"mode\"\n  optionValue=\"id\"\n  formControlName=\"transportModeId\"\n  id=\"transportModeId\"\n></p-select>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: [
          "class",
          "options",
          "placeholder",
          "showClear",
          "optionLabel",
          "optionValue",
          "formControlName",
          "id"
        ],
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "new-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<p-select\n  class=\"w-full\"\n  [options]=\"transportModeData\"\n  [placeholder]=\"dropdownPlaceholder\"\n  [showClear]=\"true\"\n  optionLabel=\"mode\"\n  optionValue=\"id\"\n  formControlName=\"transportModeId\"\n  id=\"transportModeId\">\n</p-select>"
  );
});

test("explicit formatting does not duplicate the closing tag for void elements written with an end tag", () => {
  const input = "<input pInputText id=\"address\" type=\"text\" formControlName=\"address\" maxlength=\"35\"></input>";
  const config = createConfig({
    tags: {
      input: {
        attributeOrder: ["pInputText", "id", "type", "formControlName", "maxlength"],
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<input pInputText id=\"address\" type=\"text\" formControlName=\"address\" maxlength=\"35\" />");
});

test("void tags ignore explicit closingStyle and keep self-closing output", () => {
  const input = "<input pInputText id=\"address\" type=\"text\" formControlName=\"address\" maxlength=\"35\">";
  const config = createConfig({
    tags: {
      input: {
        attributeOrder: ["pInputText", "id", "type", "formControlName", "maxlength"],
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "new-line",
        closingTagPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<input pInputText id=\"address\" type=\"text\" formControlName=\"address\" maxlength=\"35\"\n/>");
});
