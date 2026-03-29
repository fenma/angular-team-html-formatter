# Angular Team HTML Formatter

Line-preserving VS Code formatter for Angular HTML templates and standard HTML.

This extension is designed for teams that want predictable indentation everywhere, while only applying stronger formatting rules to tags that are explicitly configured in the repository. It is especially useful for Angular component templates with custom elements such as PrimeNG components like `p-select`, but it remains safe for ordinary HTML because unknown tags get `indent-only` behavior by default.

## Architecture Summary

The formatter has two main steps:

- known tags: apply configured tag-specific formatting rules
- all lines: apply safe indentation without reflow

This keeps unknown tags indentation-only and makes configured component formatting predictable.

## Features

- VS Code formatter for HTML and Angular templates
- project-based shared formatting config
- indentation-only behavior for unknown tags
- configurable tag-specific formatting for known tags
- Angular-friendly attribute matching
- no reflow or automatic line wrapping

## Behavior Rules

### Unknown tags

If a tag is not configured in the project config:

- only indentation is adjusted
- attribute text stays exactly as written
- attribute order is untouched
- closing style is untouched

### Known tags

If a tag is configured:

- attributes are matched and reordered deterministically
- unknown attributes can be placed first or last depending on config
- Angular binding syntax is preserved exactly
- empty elements can be normalized to self-closing or explicit form

## Config Reference

Create `html-formatter.config.jsonc` in your project root:

```jsonc
{
  "indent": {
    "size": 2,
    "useTabs": false
  },
  "defaultBehavior": {
    "unknownTags": "indent-only" // indent-only
  },
  "knownTagDefaults": {
    "attributeOrder": [],
    "unknownAttributesPosition": "last",   // first | last
    "sortUnknownAttributes": "preserve",   // preserve | alphabetical
    "attributeLayout": "preserve",         // preserve | multi-line | single-line
    "maxAttributeLineWidth": 100,
    "closingStyle": "explicit",            // preserve | self-closing | explicit
    "closingBracketPosition": "new-line",  // preserve | same-line | new-line
    "closingTagPosition": "same-line"      // preserve | same-line | new-line
  },
  "tags": {
    "p-select": {
      "attributeOrder": [
        "inputId",
        "class",
        "options",
        "placeholder",
        "showClear",
        "optionLabel",
        "optionValue",
        "formControlName"
      ],
      "attributeLayout": "single-line",
      "maxAttributeLineWidth": 100,
      "unknownAttributesPosition": "last",
      "sortUnknownAttributes": "preserve",
      "closingStyle": "explicit",
      "closingBracketPosition": "new-line",
      "closingTagPosition": "same-line"
    }
  }
}
```

### Top-level settings

#### `indent`

Controls indentation for the whole document, including normal HTML nesting and Angular control-flow blocks such as `@if {}` and `@for {}`.

```json
{
  "indent": {
    "size": 4,
    "useTabs": false
  }
}
```

#### `defaultBehavior`

Defines the fallback behavior for tags that are not explicitly listed in `tags`.

```json
{
  "defaultBehavior": {
    "unknownTags": "indent-only"
  }
}
```

#### `knownTagDefaults`

Provides default rule values for tags listed in `tags`.

If a tag defines its own rule, that tag-specific rule takes priority.
If a tag does not define a rule, the value from `knownTagDefaults` is used.

Supported fields:

- `attributeOrder`
- `attributeLayout`
- `maxAttributeLineWidth`
- `unknownAttributesPosition`
- `sortUnknownAttributes`
- `closingStyle`
- `closingBracketPosition`
- `closingTagPosition`

Example:

```json
{
  "knownTagDefaults": {
    "attributeLayout": "preserve",
    "maxAttributeLineWidth": 100,
    "unknownAttributesPosition": "last",
    "sortUnknownAttributes": "preserve",
    "closingStyle": "explicit",
    "closingBracketPosition": "new-line",
    "closingTagPosition": "same-line"
  }
}
```

#### `tags`

Contains per-tag formatting rules. The key is the tag name, for example `p-select`, `p-inputText` or `my-component`.

Only tags listed here get custom formatting behavior. All other tags remain `indent-only`.

Example:

```json
{
  "tags": {
    "p-select": {
      "attributeOrder": ["inputId", "class", "options"],
      "closingStyle": "self-closing"
    }
  }
}
```

### Tag rule settings

Each tag under `tags` can use the following options.

#### `attributeOrder`

Defines the preferred attribute order for a known tag.

Supported forms:

- string entries, for example `"optionLabel"`
- object entries, for example `{ "name": "ngModel", "kinds": ["two-way"] }`

Behavior:

- attributes listed here are moved into this exact order
- attributes not listed here are treated as unknown attributes
- unknown attributes are placed according to `unknownAttributesPosition`
- the formatter preserves the original attribute text and value

Important Angular behavior:

- `"optionLabel"` matches both `optionLabel` and `[optionLabel]`
- `"options"` matches both `options` and `[options]`
- `"ngModel"` can match `[(ngModel)]`

Simple example:

```json
{
  "attributeOrder": [
    "inputId",
    "class",
    "options",
    "optionLabel"
  ]
}
```

Advanced example:

```json
{
  "attributeOrder": [
    { "name": "ngModel", "kinds": ["two-way"] },
    { "name": "options", "kinds": ["property"] },
    { "name": "onChange", "kinds": ["event"] },
    { "name": "ngIf", "kinds": ["structural"] },
    { "name": "picker", "kinds": ["template-ref"] }
  ]
}
```

Supported `kinds` values:

- `plain`
- `property`
- `event`
- `two-way`
- `structural`
- `template-ref`

#### `unknownAttributesPosition`

Controls where attributes go that are not listed in `attributeOrder`.

Supported values:

- `"last"`: unknown attributes are placed after all configured attributes
- `"first"`: unknown attributes are placed before all configured attributes

Default:

- `"last"`

Example:

```json
{
  "unknownAttributesPosition": "last"
}
```

#### `attributeLayout`

Controls whether known-tag attributes stay in their current layout or are forced onto separate lines.

Supported values:

- `"preserve"`: keep the current single-line or multiline layout
- `"multi-line"`: place each attribute on its own line under the tag name
- `"single-line"`: place as many attributes on one line as possible, wrapping only when `maxAttributeLineWidth` is exceeded

Default:

- `"preserve"`

Example:

```json
{
  "attributeLayout": "single-line"
}
```

#### `maxAttributeLineWidth`

Controls the maximum total line width, measured from column 0, when `attributeLayout` is set to `"single-line"`.

Before the formatter adds the next attribute to the current line, it calculates the resulting width. If that width would exceed this value, the next attribute starts a new line and the same width check is applied again on that line.

Supported values:

- positive integers, for example `100`

Default:

- `null` (no width-based wrapping)

Example:

```json
{
  "attributeLayout": "single-line",
  "maxAttributeLineWidth": 100
}
```

#### `sortUnknownAttributes`

Controls how unknown attributes are ordered relative to each other.

Supported values:

- `"preserve"`: keep their original order
- `"alphabetical"`: sort unknown attributes alphabetically by normalized attribute name

Default:

- `"preserve"`

Example:

```json
{
  "sortUnknownAttributes": "preserve"
}
```

#### `closingStyle`

Controls how the tag is closed.

Supported values:

- `"preserve"`: keep the current closing style when possible
- `"self-closing"`: format empty elements as `<tag ... />`
- `"explicit"`: format as `<tag ...></tag>`

Behavior notes:

- `self-closing` only collapses a tag if the element is empty or contains whitespace only
- if the tag contains content, the formatter stays safe and keeps explicit closing

Examples:

```json
{
  "closingStyle": "self-closing"
}
```

```json
{
  "closingStyle": "explicit"
}
```

#### `closingBracketPosition`

Controls where the closing `>` or `/>` is placed for a known tag.

Supported values:

- `"preserve"`: keep the existing style when possible, otherwise use the formatter's safe fallback
- `"same-line"`: put the closing `>` or `/>` on the same line as the final attribute
- `"new-line"`: put the closing `>` or `/>` on its own line

Default:

- `"preserve"`

Example with `"same-line"`:

```html
<p-select
  inputId="accountName"
  class="w-full" />
```

Example with `"new-line"`:

```html
<p-select
  inputId="accountName"
  class="w-full"
/>
```

#### `closingTagPosition`

Controls where the explicit closing tag `</tag>` is placed when `closingStyle` is `"explicit"`.

Supported values:

- `"preserve"`: keep the existing style when possible, otherwise use the formatter's safe fallback
- `"same-line"`: keep `</tag>` on the same line as the opening bracket line
- `"new-line"`: move `</tag>` to its own next line

Default:

- `"preserve"`

Example with `"same-line"`:

```html
<p-select
  inputId="accountName"
  class="w-full"
></p-select>
```

Example with `"new-line"`:

```html
<p-select
  inputId="accountName"
  class="w-full" >
</p-select>
```

### Legacy compatibility fields

The formatter also accepts these older shorthand fields at the top level:

- `indentSize`
- `useTabs`

These are normalized internally into:

```json
{
  "indent": {
    "size": 2,
    "useTabs": false
  }
}
```

### Invalid config behavior

If the config is missing or invalid:

- the formatter does not crash
- safe defaults are used
- unknown tags remain `indent-only`
- commands such as `Validate HTML Formatter Config` can help inspect the active config

## Attribute Matching

Attribute matching uses the normalized attribute name.

- `inputId` matches `inputId`
- `options` matches `options` and `[options]`
- `placeholder` matches `placeholder` and `[placeholder]`
- `ngModel` can match `[(ngModel)]`

If you need more control, `attributeOrder` also supports objects:

```json
{
  "name": "ngModel",
  "kinds": ["two-way"]
}
```

Supported kinds:

- `plain`
- `property`
- `event`
- `two-way`
- `structural`
- `template-ref`

## PrimeNG `p-select` Example

With this rule:

```json
{
  "attributeOrder": [
    "inputId",
    "class",
    "options",
    "placeholder",
    "showClear",
    "optionLabel",
    "optionValue",
    "formControlName"
  ]
}
```

this input:

```html
<p-select [showClear]="true" optionValue="id" class="w-full" inputId="accountName" [options]="accountData" [placeholder]="dropdownPlaceholder" optionLabel="code" formControlName="accountName" />
```

becomes:

```html
<p-select inputId="accountName" class="w-full" [options]="accountData" [placeholder]="dropdownPlaceholder" [showClear]="true" optionLabel="code" optionValue="id" formControlName="accountName" />
```

## Commands

- `Format HTML with Team Formatter`
- `Validate HTML Formatter Config`
- `Show Active HTML Formatter Config`

## Make It The Default Formatter

Add this to your workspace settings:

```json
{
  "[html]": {
    "editor.defaultFormatter": "Fenma.angular-team-html-formatter"
  },
  "[angular-html]": {
    "editor.defaultFormatter": "Fenma.angular-team-html-formatter"
  }
}
```

If your Angular templates are associated with `html`, this is enough. If your setup uses a separate language id, add the matching override as well.

## Local Development

1. Open this extension project in VS Code.
2. Run `npm install` in the integrated terminal.
3. Run `npm test`.
4. Press `F5` to start the Extension Development Host.
5. Open an Angular project with `html-formatter.config.jsonc`.
6. Run `Format Document` or `Format Selection`.

## Build A VSIX

Build:

```bash
npm run package:vsix
```

This creates a `.vsix` in `dist/`, for example:

```text
dist/angular-team-html-formatter-0.1.0.vsix
```

Install it in VS Code via:

1. `Extensions` view
2. `...` menu
3. `Install from VSIX...`
4. Select the generated file from `dist/`

## Debugging

- Use the command `Show Active HTML Formatter Config` to inspect the resolved config.
- Enable `angularTeamHtmlFormatter.enableDebugLogs` in VS Code settings to write debug output to the extension output channel.

## Limitations

- The formatter intentionally avoids full HTML pretty-printing and therefore does not try to normalize every edge case.
- Range formatting works best when the selection contains complete tags.
- Inline Angular templates are not implemented yet, but the formatter core is structured so that support can be added later.
- For safety, self-closing conversion only collapses explicit elements when the content between start and end tags is empty or whitespace-only.

## Future Work

- Inline Angular template support in TypeScript files
- More configurable multiline attribute layouts
- Smarter range-format context handling
- Extension host integration tests
