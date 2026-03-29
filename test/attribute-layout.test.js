"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatText } = require("../src/formatter");
const { createConfig, createLogger } = require("../test-support/helpers");

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

test("attributeLayout single-line flattens known tag attributes onto one line", () => {
  const input = "<p-select\n  class=\"w-full\"\n  inputId=\"order\"\n  [options]=\"items\"\n/>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class", "options"],
        attributeLayout: "single-line",
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select inputId=\"order\" class=\"w-full\" [options]=\"items\" />");
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
