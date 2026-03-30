"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { formatText } = require("../src/formatter");
const { createConfig, createLogger } = require("../test-support/helpers");

const ATTRIBUTE_LAYOUTS = ["preserve", "multi-line", "single-line"];
const CLOSING_STYLES = ["self-closing", "explicit"];
const BRACKET_POSITIONS = ["same-line", "next-line"];
const CLOSING_TAG_POSITIONS = ["same-line", "next-line"];

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
        : closingTagPosition === "next-line"
          ? `${inlineStartTag}>\n</p-select>`
          : `${inlineStartTag}></p-select>`;
    }

    return closingStyle === "self-closing"
      ? `${inlineStartTag}\n/>`
      : closingTagPosition === "next-line"
        ? `${inlineStartTag}\n>\n</p-select>`
        : `${inlineStartTag}\n></p-select>`;
  }

  if (attributeLayout === "preserve" && closingBracketPosition === "same-line") {
    return closingStyle === "self-closing"
      ? `${inlineStartTag} />`
      : closingTagPosition === "next-line"
        ? `${inlineStartTag}>\n</p-select>`
        : `${inlineStartTag}></p-select>`;
  }

  if (closingBracketPosition === "same-line") {
    return closingStyle === "self-closing"
      ? `${multilineStartTag} />`
      : closingTagPosition === "next-line"
        ? `${multilineStartTag}>\n</p-select>`
        : `${multilineStartTag}></p-select>`;
  }

  return closingStyle === "self-closing"
    ? `${multilineStartTag}\n/>`
    : closingTagPosition === "next-line"
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

test("knownTagDefaults can drive explicit next-line closing tag formatting", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"name\"\n/>";
  const config = createConfig({
    knownTagDefaults: {
      closingStyle: "explicit",
      closingBracketPosition: "next-line",
      closingTagPosition: "next-line"
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

test("single-line explicit same-line bracket with next-line closing tag puts the end tag on the next line", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"items\"\n/>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select class=\"w-full\" [options]=\"items\">\n</p-select>");
});

test("single-line explicit next-line bracket with next-line closing tag keeps both on their own lines", () => {
  const input = "<p-select\n  class=\"w-full\"\n  [options]=\"items\"\n/>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class", "options"],
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "next-line",
        closingTagPosition: "next-line"
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
      closingTagPosition: "next-line"
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

test("knownTagDefaults closingTagPosition preserve keeps an existing next-line closing tag", () => {
  const input = "<p-select class=\"w-full\">\n</p-select>";
  const config = createConfig({
    knownTagDefaults: {
      attributeLayout: "multi-line",
      closingStyle: "explicit",
      closingBracketPosition: "same-line",
      closingTagPosition: "preserve"
    },
    tags: {
      "p-select": {
        attributeOrder: ["class"]
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\">\n</p-select>");
});

test("knownTagDefaults closingBracketPosition preserve keeps an existing next-line closing bracket", () => {
  const input = "<p-select\n  class=\"w-full\"\n/>";
  const config = createConfig({
    knownTagDefaults: {
      attributeLayout: "multi-line",
      closingStyle: "self-closing",
      closingBracketPosition: "preserve"
    },
    tags: {
      "p-select": {
        attributeOrder: ["class"]
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\"\n/>");
});

test("existing explicit tags honor same-line bracket and next-line closing tag", () => {
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
        closingTagPosition: "next-line"
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
        closingBracketPosition: "next-line",
        closingTagPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<input pInputText id=\"address\" type=\"text\" formControlName=\"address\" maxlength=\"35\"\n/>");
});

test("self-closing rules do not collapse known tags that contain text", () => {
  const input = "<mytag>halo</mytag>";
  const config = createConfig({
    tags: {
      mytag: {
        attributeLayout: "single-line",
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<mytag>halo</mytag>");
});

test("self-closing rules do not collapse known tags that contain child elements", () => {
  const input = "<mytag><div>test</div></mytag>";
  const config = createConfig({
    tags: {
      mytag: {
        attributeLayout: "single-line",
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<mytag><div>test</div></mytag>");
});

test("self-closing fallback keeps explicit text content and still honors next-line closing bracket", () => {
  const input = "<mytag>halo</mytag>";
  const config = createConfig({
    tags: {
      mytag: {
        closingStyle: "self-closing",
        closingBracketPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<mytag>halo</mytag>");
});

test("self-closing fallback keeps child elements and still honors next-line closing bracket", () => {
  const input = "<mytag><div>test</div></mytag>";
  const config = createConfig({
    tags: {
      mytag: {
        closingStyle: "self-closing",
        closingBracketPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<mytag><div>test</div></mytag>");
});

test("self-closing fallback keeps attributes and child elements while honoring next-line closing bracket", () => {
  const input = "<mytag class=\"hero\" data-id=\"7\"><div>test</div></mytag>";
  const config = createConfig({
    tags: {
      mytag: {
        attributeOrder: ["class", "data-id"],
        attributeLayout: "multi-line",
        closingStyle: "self-closing",
        closingBracketPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<mytag\n  class=\"hero\"\n  data-id=\"7\"\n>\n  <div>test</div></mytag>");
});

test("explicit formatting without attributes ignores next-line closing bracket", () => {
  const input = "<mytag></mytag>";
  const config = createConfig({
    tags: {
      mytag: {
        closingStyle: "explicit",
        closingBracketPosition: "next-line",
        closingTagPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<mytag></mytag>");
});

test("self-closing formatting without attributes ignores next-line closing bracket", () => {
  const input = "<mytag></mytag>";
  const config = createConfig({
    tags: {
      mytag: {
        closingStyle: "self-closing",
        closingBracketPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<mytag />");
});

test("explicit formatting preserves existing text content", () => {
  const input = "<p-select class=\"w-full\">halo</p-select>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class"],
        attributeLayout: "multi-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select\n  class=\"w-full\">halo</p-select>");
});

test("p-inputNumber explicit same-line bracket with next-line closing tag does not duplicate the end tag", () => {
  const input =
    "<p-inputnumber\n                  inputId=\"packageWeight\"\n                  mode=\"decimal\"\n                  [locale]=\"currentLocale()\"\n                  [maxFractionDigits]=\"2\"\n                  [min]=\"0\"\n                  formControlName=\"packageWeight\"\n                ></p-inputnumber>";
  const config = createConfig({
    tags: {
      "p-inputNumber": {
        attributeOrder: ["inputId", "mode", "locale", "maxFractionDigits", "min", "max", "formControlName"],
        attributeLayout: "multi-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<p-inputnumber\n  inputId=\"packageWeight\"\n  mode=\"decimal\"\n  [locale]=\"currentLocale()\"\n  [maxFractionDigits]=\"2\"\n  [min]=\"0\"\n  formControlName=\"packageWeight\">\n</p-inputnumber>"
  );
});

test("full block with p-inputnumber keeps a single explicit closing tag on the next line", () => {
  const input =
    "<div class=\"field basis-1/2 required\">\n  <label for=\"packageWeight\">\n    Weight (<a [routerLink]=\"\" (click)=\"toggleWeightUnit()\">{{showAsKg ? 'kg' : 'lbs'}}</a>)\n  </label>\n  <p-inputnumber\n    inputId=\"packageWeight\"\n    mode=\"decimal\"\n    [locale]=\"currentLocale()\"\n    [maxFractionDigits]=\"2\"\n    [min]=\"0\"\n    formControlName=\"packageWeight\"\n  ></p-inputnumber>\n  <app-validation-text controlName=\"packageWeight\" label=\"Weight\"></app-validation-text>\n</div>";
  const config = createConfig({
    tags: {
      "p-inputNumber": {
        attributeOrder: ["inputId", "mode", "locale", "maxFractionDigits", "min", "max", "formControlName"],
        attributeLayout: "multi-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<div class=\"field basis-1/2 required\">\n  <label for=\"packageWeight\">\n    Weight (<a [routerLink]=\"\" (click)=\"toggleWeightUnit()\">{{showAsKg ? 'kg' : 'lbs'}}</a>)\n  </label>\n  <p-inputnumber\n    inputId=\"packageWeight\"\n    mode=\"decimal\"\n    [locale]=\"currentLocale()\"\n    [maxFractionDigits]=\"2\"\n    [min]=\"0\"\n    formControlName=\"packageWeight\">\n  </p-inputnumber>\n  <app-validation-text controlName=\"packageWeight\" label=\"Weight\"></app-validation-text>\n</div>"
  );
});

test("closingTagPosition same-line normalizes empty explicit buttons onto one line", () => {
  const input =
    "<button class=\"p-button-outlined\" pButton type=\"button\" label=\"Overview\" [routerLink]=\"[baseLink, 'list']\"></button>\n<button class=\"p-button-primary\" pButton type=\"submit\" label=\"Save\">\n</button>\n<button #topbarmenubutton class=\"p-link layout-topbar-menu-button layout-topbar-button\" (click)=\"layoutService.showProfileSidebar()\"></button>";
  const config = createConfig({
    tags: {
      button: {
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "same-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<button class=\"p-button-outlined\" pButton type=\"button\" label=\"Overview\" [routerLink]=\"[baseLink, 'list']\"></button>\n<button class=\"p-button-primary\" pButton type=\"submit\" label=\"Save\"></button>\n<button #topbarmenubutton class=\"p-link layout-topbar-menu-button layout-topbar-button\" (click)=\"layoutService.showProfileSidebar()\"></button>"
  );
});

test("closingTagPosition next-line normalizes empty explicit buttons onto the next line", () => {
  const input =
    "<button class=\"p-button-outlined\" pButton type=\"button\" label=\"Overview\" [routerLink]=\"[baseLink, 'list']\"></button>\n<button class=\"p-button-primary\" pButton type=\"submit\" label=\"Save\">\n</button>\n<button #topbarmenubutton class=\"p-link layout-topbar-menu-button layout-topbar-button\" (click)=\"layoutService.showProfileSidebar()\"></button>";
  const config = createConfig({
    tags: {
      button: {
        attributeLayout: "single-line",
        closingStyle: "explicit",
        closingBracketPosition: "same-line",
        closingTagPosition: "next-line"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(
    output,
    "<button class=\"p-button-outlined\" pButton type=\"button\" label=\"Overview\" [routerLink]=\"[baseLink, 'list']\">\n</button>\n<button class=\"p-button-primary\" pButton type=\"submit\" label=\"Save\">\n</button>\n<button #topbarmenubutton class=\"p-link layout-topbar-menu-button layout-topbar-button\" (click)=\"layoutService.showProfileSidebar()\">\n</button>"
  );
});

test("non-void standard HTML tags ignore disallowed self-closing closingStyle", () => {
  const input = "<div class=\"panel\"></div>";
  const config = createConfig({
    tags: {
      div: {
        attributeLayout: "single-line",
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<div class=\"panel\"></div>");
});

test("custom component tags can still use self-closing closingStyle", () => {
  const input = "<p-select class=\"w-full\"></p-select>";
  const config = createConfig({
    tags: {
      "p-select": {
        attributeOrder: ["class"],
        attributeLayout: "single-line",
        closingStyle: "self-closing"
      }
    }
  });

  const output = formatText(input, config, createLogger());
  assert.equal(output, "<p-select class=\"w-full\" />");
});
