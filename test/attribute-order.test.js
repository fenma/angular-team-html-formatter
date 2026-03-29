"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatText } = require("../src/formatter");
const { createConfig, createLogger } = require("../test-support/helpers");

test("p-select attribute order is enforced", () => {
  const input =
    "<p-select [showClear]=\"true\" optionValue=\"id\" class=\"w-full\" inputId=\"order\" [options]=\"opts\" optionLabel=\"code\" formControlName=\"original\" [placeholder]=\"label\" />";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: [
          "inputId",
          "class",
          "options",
          "placeholder",
          "showClear",
          "optionLabel",
          "optionValue",
          "formControlName"
        ],
        unknownAttributesPosition: "last",
        closingStyle: "self-closing",
        closingBracketPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<p-select inputId=\"order\" class=\"w-full\" [options]=\"opts\" [placeholder]=\"label\" [showClear]=\"true\" optionLabel=\"code\" optionValue=\"id\" formControlName=\"original\" />"
  );
});

test("unknown attributes remain last", () => {
  const input = "<p-select data-id=\"x\" class=\"w-full\" inputId=\"order\" [options]=\"opts\" />";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class", "options"],
        unknownAttributesPosition: "last",
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select inputId=\"order\" class=\"w-full\" [options]=\"opts\" data-id=\"x\" />");
});

test("angular bindings remain intact", () => {
  const input =
    "<p-select (onChange)=\"save($event)\" [(ngModel)]=\"value\" [options]=\"items\" *ngIf=\"ready\" #picker />";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: [
          { name: "ngModel", kinds: ["two-way"] },
          { name: "options", kinds: ["property"] },
          { name: "onChange", kinds: ["event"] },
          { name: "ngIf", kinds: ["structural"] },
          { name: "picker", kinds: ["template-ref"] }
        ],
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<p-select [(ngModel)]=\"value\" [options]=\"items\" (onChange)=\"save($event)\" *ngIf=\"ready\" #picker />"
  );
});

test("firstLineAttributes stay on the opening line before multi-line ordered attributes", () => {
  const input =
    "<p-table [value]=\"models\" [paginator]=\"true\" class=\"p-datatable-sm\" #dt1 [formGroup]=\"formGroup\"></p-table>";
  const config = createConfig({
    tags: {
      "p-table": {
        firstLineAttributes: ["#dt1"],
        attributeOrder: ["class", "value", "formGroup", "paginator"],
        attributeLayout: "multi-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<p-table #dt1\n  class=\"p-datatable-sm\"\n  [value]=\"models\"\n  [formGroup]=\"formGroup\"\n  [paginator]=\"true\"></p-table>"
  );
});

test("firstLineAttributes stay on the opening line before single-line ordered attributes", () => {
  const input =
    "<p-table [value]=\"models\" [paginator]=\"true\" class=\"p-datatable-sm\" #dt1 [formGroup]=\"formGroup\"></p-table>";
  const config = createConfig({
    tags: {
      "p-table": {
        firstLineAttributes: ["#dt1"],
        attributeOrder: ["class", "value", "formGroup", "paginator"],
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<p-table #dt1 class=\"p-datatable-sm\" [value]=\"models\" [formGroup]=\"formGroup\" [paginator]=\"true\"></p-table>"
  );
});
