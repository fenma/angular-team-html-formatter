"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatText, getIndentLevelAtEnd } = require("../src/formatter");
const { DEFAULT_CONFIG } = require("../src/config/default-config");
const { normalizeConfig } = require("../src/config/config-reader");

function createLogger() {
  return {
    debug() {},
    warn() {}
  };
}

function createConfig(partial) {
  return normalizeConfig(partial, []);
}

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
        unknownAttributesPosition: "bottom",
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

test("unknown attributes remain at the bottom", () => {
  const input = "<p-select data-id=\"x\" class=\"w-full\" inputId=\"order\" [options]=\"opts\" />";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["inputId", "class", "options"],
        unknownAttributesPosition: "bottom",
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select inputId=\"order\" class=\"w-full\" [options]=\"opts\" data-id=\"x\" />");
});

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
        closingBracketPosition: "new-line"
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
        closingBracketPosition: "new-line"
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
        closingBracketPosition: "new-line"
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
