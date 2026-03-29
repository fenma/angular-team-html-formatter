"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatText, getIndentLevelAtEnd } = require("../src/formatter");
const { DEFAULT_CONFIG } = require("../src/config/default-config");
const { createConfig, createLogger } = require("../test-support/helpers");

test("next sibling after multiline self-closing tag keeps parent indent", () => {
  const input =
    "<div>\n<div class=\"field required\">\n<p-select\nclass=\"w-full\"\n[options]=\"transportModeData\"\n[placeholder]=\"dropdownPlaceholder\"\n[showClear]=\"true\"\noptionLabel=\"mode\"\noptionValue=\"id\"\nformControlName=\"transportModeId\"\nid=\"transportModeId\"\n/>\n<app-validation-text label=\"Type\"></app-validation-text>\n</div>\n</div>";
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
        closingStyle: "self-closing",
        closingBracketPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<div>\n  <div class=\"field required\">\n    <p-select\n      class=\"w-full\"\n      [options]=\"transportModeData\"\n      [placeholder]=\"dropdownPlaceholder\"\n      [showClear]=\"true\"\n      optionLabel=\"mode\"\n      optionValue=\"id\"\n      formControlName=\"transportModeId\"\n      id=\"transportModeId\"\n    />\n    <app-validation-text label=\"Type\"></app-validation-text>\n  </div>\n</div>"
  );
});

test("next sibling after multiline explicit tag keeps parent indent", () => {
  const input =
    "<div class=\"basis-1/2 space-y-4\">\n              <div class=\"field required\">\n                <label for=\"transportModeId\">Type</label>\n                <p-select\n                class=\"w-full\"\n                [options]=\"transportModeData\"\n                [placeholder]=\"dropdownPlaceholder\"\n                [showClear]=\"true\"\n                optionLabel=\"mode\"\n                optionValue=\"id\"\n                formControlName=\"transportModeId\"\n                id=\"transportModeId\"\n              ></p-select>\n                <app-validation-text label=\"Type\" controlName=\"transportModeId\"></app-validation-text>\n              </div>";
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
        closingBracketPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<div class=\"basis-1/2 space-y-4\">\n  <div class=\"field required\">\n    <label for=\"transportModeId\">Type</label>\n    <p-select\n      class=\"w-full\"\n      [options]=\"transportModeData\"\n      [placeholder]=\"dropdownPlaceholder\"\n      [showClear]=\"true\"\n      optionLabel=\"mode\"\n      optionValue=\"id\"\n      formControlName=\"transportModeId\"\n      id=\"transportModeId\"\n    ></p-select>\n    <app-validation-text label=\"Type\" controlName=\"transportModeId\"></app-validation-text>\n  </div>"
  );
});

test("selection formatting keeps sibling and closing tag indent using parent context", () => {
  const selection =
    "<p-select\nclass=\"w-full\"\n[options]=\"transportModeData\"\n[placeholder]=\"dropdownPlaceholder\"\n[showClear]=\"true\"\noptionLabel=\"mode\"\noptionValue=\"id\"\nformControlName=\"transportModeId\"\nid=\"transportModeId\"\n></p-select>\n<app-validation-text label=\"Type\" controlName=\"transportModeId\"></app-validation-text>\n</div>";
  const prefix = "<div class=\"basis-1/2 space-y-4\">\n  <div class=\"field required\">\n    <label for=\"transportModeId\">Type</label>\n";
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
        closingBracketPosition: "next-line"
      }
    }
  });

  const output = formatText(selection, config, createLogger(), {
    initialIndentLevel: getIndentLevelAtEnd(prefix)
  });

  assert.equal(
    output,
    "    <p-select\n      class=\"w-full\"\n      [options]=\"transportModeData\"\n      [placeholder]=\"dropdownPlaceholder\"\n      [showClear]=\"true\"\n      optionLabel=\"mode\"\n      optionValue=\"id\"\n      formControlName=\"transportModeId\"\n      id=\"transportModeId\"\n    ></p-select>\n    <app-validation-text label=\"Type\" controlName=\"transportModeId\"></app-validation-text>\n  </div>"
  );
});

test("selection formatting keeps second line of multiline tag indented", () => {
  const selection =
    "<input pInputText id=\"name\" type=\"text\" maxlength=\"100\"\nformControlName=\"name\" required [pAutoFocus]=\"true\" [autofocus]=\"true\">\n</div>";
  const prefix = "<div>\n";
  const output = formatText(selection, DEFAULT_CONFIG, createLogger(), {
    initialIndentLevel: getIndentLevelAtEnd(prefix)
  });

  assert.equal(
    output,
    "  <input pInputText id=\"name\" type=\"text\" maxlength=\"100\"\n    formControlName=\"name\" required [pAutoFocus]=\"true\" [autofocus]=\"true\">\n</div>"
  );
});

test("selection formatting does not duplicate explicit closing tags when moving them to the next line", () => {
  const selection =
    "<p-inputnumber\ninputId=\"packageWeight\"\nmode=\"decimal\"\n[locale]=\"currentLocale()\"\n[maxFractionDigits]=\"2\"\n[min]=\"0\"\nformControlName=\"packageWeight\"\n></p-inputnumber>\n</div>";
  const prefix = "<form>\n  <div>\n";
  const config = createConfig({
    tags: {
      "p-inputnumber": {
        attributeOrder: ["inputId", "mode", "locale", "maxFractionDigits", "min", "formControlName"],
        attributeLayout: "multi-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "next-line"
      }
    }
  });

  const output = formatText(selection, config, createLogger(), {
    initialIndentLevel: getIndentLevelAtEnd(prefix)
  });

  assert.equal(
    output,
    "    <p-inputnumber\n      inputId=\"packageWeight\"\n      mode=\"decimal\"\n      [locale]=\"currentLocale()\"\n      [maxFractionDigits]=\"2\"\n      [min]=\"0\"\n      formControlName=\"packageWeight\">\n    </p-inputnumber>\n  </div>"
  );
});
