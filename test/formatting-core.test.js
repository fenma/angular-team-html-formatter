"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatText } = require("../src/formatter");
const { DEFAULT_CONFIG } = require("../src/config/default-config");
const { normalizeConfig } = require("../src/config/config-reader");
const { createConfig, createLogger } = require("../test-support/helpers");

test("unknown tag gets indentation only", () => {
  const input = "<div>\n<custom-box foo=\"1\" bar=\"2\">\n<span>Hi</span>\n</custom-box>\n</div>";
  const config = createConfig({
    indent: {
      size: 2,
      useTabs: false
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<div>\n  <custom-box foo=\"1\" bar=\"2\">\n    <span>Hi</span>\n  </custom-box>\n</div>");
});

test("formatter does not introduce unwanted wrapping for unknown tags", () => {
  const input = "<div>\n  <custom-box foo=\"1\" bar=\"2\" baz=\"3\">content</custom-box>\n</div>";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(output, input);
});

test("invalid config does not crash formatting", () => {
  const input = "<div>\n<span>Hi</span>\n</div>";
  const config = normalizeConfig("invalid", []);
  const output = formatText(input, config, createLogger());
  assert.equal(output, "<div>\n  <span>Hi</span>\n</div>");
});

test("angular if control flow indents nested html", () => {
  const input = "@if (ready) {\n<div>\n<span>Hi</span>\n</div>\n}";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(output, "@if (ready) {\n  <div>\n    <span>Hi</span>\n  </div>\n}");
});

test("angular else block aligns with closing brace", () => {
  const input = "@if (ready) {\n<div>One</div>\n} @else {\n<div>Two</div>\n}";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(output, "@if (ready) {\n  <div>One</div>\n} @else {\n  <div>Two</div>\n}");
});

test("angular for empty blocks indent correctly", () => {
  const input = "@for (item of items; track item.id) {\n<p-select class=\"w-full\" />\n} @empty {\n<div>No items</div>\n}";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(
    output,
    "@for (item of items; track item.id) {\n  <p-select class=\"w-full\" />\n} @empty {\n  <div>No items</div>\n}"
  );
});

test("multiline unknown tag continuation lines keep the same indent", () => {
  const input =
    "<input pInputText id=\"name\" type=\"text\" maxlength=\"100\"\nformControlName=\"name\" required [pAutoFocus]=\"true\" [autofocus]=\"true\">";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(
    output,
    "<input pInputText id=\"name\" type=\"text\" maxlength=\"100\"\n  formControlName=\"name\" required [pAutoFocus]=\"true\" [autofocus]=\"true\">"
  );
});

test("multiline non-self-closing tag keeps parent closing tag aligned", () => {
  const input =
    "<div>\n<input pInputText id=\"name\" type=\"text\" maxlength=\"100\"\nformControlName=\"name\" required [pAutoFocus]=\"true\" [autofocus]=\"true\">\n</div>";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(
    output,
    "<div>\n  <input pInputText id=\"name\" type=\"text\" maxlength=\"100\"\n    formControlName=\"name\" required [pAutoFocus]=\"true\" [autofocus]=\"true\">\n</div>"
  );
});
