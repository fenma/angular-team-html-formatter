"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractMeaningfulTextNodes,
  extractSignificantContent,
  formatText,
  hasMeaningfulContentChange,
  hasTextWhitespaceChange,
  normalizeAngularExpression,
  normalizeInterpolationWhitespaceInText
} = require("../src/formatter");
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

test("extractSignificantContent keeps text nodes, comments, and declarations", () => {
  const input = "<!doctype html>\n<div>Hello {{ name }}</div>\n<!-- keep me -->\n<span>World</span>";
  assert.deepEqual(extractSignificantContent(input), [
    { kind: "declaration", value: "<!doctype html>" },
    { kind: "text", value: "Hello {{ name }}" },
    { kind: "comment", value: "<!-- keep me -->" },
    { kind: "text", value: "World" }
  ]);
});

test("extractSignificantContent ignores Angular control-flow syntax between tags", () => {
  const input = "<div>\n@if (ready) {\n  <span>Hello</span>\n}\n</div>";
  assert.deepEqual(extractSignificantContent(input), [{ kind: "text", value: "Hello" }]);
});

test("hasMeaningfulContentChange detects deleted text content", () => {
  assert.equal(
    hasMeaningfulContentChange("<div>Hello {{ name }}</div>", "<div>Hello</div>"),
    true
  );
});

test("hasMeaningfulContentChange ignores Angular control-flow indentation-only changes", () => {
  assert.equal(
    hasMeaningfulContentChange(
      "<div>\n@if (ready) {\n<span>Hello</span>\n}\n</div>",
      "<div>\n  @if (ready) {\n    <span>Hello</span>\n  }\n</div>"
    ),
    false
  );
});

test("normalizeInterpolationWhitespaceInText adds one space inside interpolation braces", () => {
  assert.equal(normalizeInterpolationWhitespaceInText("{{value}}"), "{{ value }}");
  assert.equal(normalizeInterpolationWhitespaceInText("{{  value  }}"), "{{ value }}");
});

test("normalizeAngularExpression adds spaces around top-level pipes", () => {
  assert.equal(normalizeAngularExpression("value|currency"), "value | currency");
  assert.equal(normalizeAngularExpression("value  |date:'short'"), "value | date:'short'");
});

test("normalizeAngularExpression preserves pipes inside string literals", () => {
  assert.equal(
    normalizeAngularExpression("value | myPipe:'a|b'"),
    "value | myPipe:'a|b'"
  );
});

test("extractMeaningfulTextNodes keeps raw whitespace for text nodes with content", () => {
  const input = "<div>\n  Hello\n    world\n</div>";
  assert.deepEqual(extractMeaningfulTextNodes(input), [
    { text: "\n  Hello\n    world\n", preserveWhitespace: false }
  ]);
});

test("extractMeaningfulTextNodes ignores Angular control-flow syntax", () => {
  const input = "@if (ready) {\n<div>Hello</div>\n} @else {\n<div>Fallback</div>\n}";
  assert.deepEqual(extractMeaningfulTextNodes(input), [
    { text: "Hello", preserveWhitespace: false },
    { text: "Fallback", preserveWhitespace: false }
  ]);
});

test("extractMeaningfulTextNodes marks pre content as whitespace-preserving", () => {
  const input = "<pre>\n  Hello\n    world\n</pre>";
  assert.deepEqual(extractMeaningfulTextNodes(input), [
    { text: "\n  Hello\n    world\n", preserveWhitespace: true }
  ]);
});

test("hasTextWhitespaceChange detects whitespace changes inside text nodes", () => {
  assert.equal(
    hasTextWhitespaceChange("<pre>\n  Hello\n    world\n</pre>", "<pre>\n  Hello\n  world\n</pre>"),
    true
  );
});

test("strict textWhitespace safety falls back to the original text in preformatted content", () => {
  const input = "<div>\n<pre>\n  Hello\n    world\n</pre>\n</div>";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(output, input);
});

test("strict textWhitespace allows indentation-only changes in normal HTML text", () => {
  const input = "<section>\n<div>\n  Hello\n    world\n</div>\n</section>";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(output, "<section>\n  <div>\n    Hello\n    world\n  </div>\n</section>");
});

test("formatter normalizes interpolation spacing in text nodes", () => {
  const input = "<div>{{value}}</div>\n<p>{{  value  }}</p>";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(output, "<div>{{ value }}</div>\n<p>{{ value }}</p>");
});

test("formatter normalizes pipe spacing in text-node interpolations", () => {
  const input = "<div>{{ value|currency }}</div>\n<p>{{ value  |date:'short' }}</p>";
  const output = formatText(input, DEFAULT_CONFIG, createLogger());
  assert.equal(output, "<div>{{ value | currency }}</div>\n<p>{{ value | date:'short' }}</p>");
});

test("normalized textWhitespace allows indentation changes around text nodes", () => {
  const input = "<section>\n<div>\n  Hello\n    world\n</div>\n</section>";
  const config = createConfig({
    contentSafety: {
      textWhitespace: "normalized"
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<section>\n  <div>\n    Hello\n    world\n  </div>\n</section>");
});

test("formatting preserves significant text content while reordering attributes", () => {
  const input =
    "<p-select [options]=\"items\" class=\"w-full\" inputId=\"account\">Selected: {{ selectedLabel }}</p-select>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class", "options"],
        closingStyle: "explicit"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<p-select inputId=\"account\" class=\"w-full\" [options]=\"items\">Selected: {{ selectedLabel }}</p-select>"
  );
});
