"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatText } = require("../src/formatter");
const { createConfig, createLogger } = require("../test-support/helpers");

test("closingStyle self-closing collapses empty explicit tags", () => {
  const input = "<p-select class=\"w-full\"></p-select>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class"],
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select class=\"w-full\" />");
});

test("closingStyle explicit expands self-closing tags", () => {
  const input = "<p-select class=\"w-full\" />";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class"],
        closingStyle: "explicit"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select class=\"w-full\"></p-select>");
});

test("closingBracketPosition same-line keeps bracket next to last attribute", () => {
  const input = "<p-select\n  class=\"w-full\"\n  inputId=\"order\"\n/>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class"],
        closingStyle: "self-closing",
        closingBracketPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  inputId=\"order\"\n  class=\"w-full\" />");
});

test("closingBracketPosition new-line puts bracket on its own line", () => {
  const input = "<p-select class=\"w-full\" inputId=\"order\" />";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class"],
        closingStyle: "self-closing",
        closingBracketPosition: "new-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  inputId=\"order\"\n  class=\"w-full\"\n/>");
});

test("explicit new-line closing keeps bracket on its own line", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n/>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        closingStyle: "explicit",
        closingBracketPosition: "new-line",
        closingTagPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n></p-select>");
});

test("explicit same-line closing keeps closing bracket on the last attribute line", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n/>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "new-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\"\n  [options]=\"name\" >\n</p-select>");
});

test("explicit new-line closing tag can move to the next line", () => {
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
  assert.equal(output, "<p-select\n  class=\"w-full\"\n  [options]=\"name\" ></p-select>");
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
    "<p-select\n  class=\"w-full\"\n  [options]=\"transportModeData\"\n  [placeholder]=\"dropdownPlaceholder\"\n  [showClear]=\"true\"\n  optionLabel=\"mode\"\n  optionValue=\"id\"\n  formControlName=\"transportModeId\"\n  id=\"transportModeId\" >\n</p-select>"
  );
});

test("self-closing new-line keeps slash bracket on its own line", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n></p-select>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        closingStyle: "self-closing",
        closingBracketPosition: "new-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n/>");
});

test("self-closing same-line keeps slash bracket on the last attribute line", () => {
  const input = "<p-select\n  class=\"w-full\" [options]=\"name\"\n></p-select>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        closingStyle: "self-closing",
        closingBracketPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\" [options]=\"name\" />");
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
