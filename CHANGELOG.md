# Changelog

## 0.6.0

- Added regex support for `firstLineAttributes` and `attributeOrder`, including validation, schema support, and examples in the README

## 0.5.0

- Added tag-setting constraints so standard HTML tags cannot use `closingStyle`, while custom/component tags still can
- Added validation so `closingTagPosition` is rejected whenever `closingStyle` is `"self-closing"`

## 0.4.0

- Added `firstLineAttributes` so selected attributes can stay on the tag line before the remaining attributes follow the configured `attributeLayout`
- Fixed configured non-empty tags so child content and text are preserved when `closingStyle` would otherwise collapse them
- Fixed `closingTagPosition: "preserve"` so explicit closing tags keep their original same-line or next-line placement
- Fixed `closingBracketPosition: "preserve"` so known tags keep an existing multi-line bracket layout
- Fixed `closingBracketPosition` semantics so `"next-line"` only applies when a tag has attributes, and tags without attributes keep `>` on the tag line
- Added regression coverage for tags with text, child elements, attributes, and inherited known-tag defaults across closing-style combinations

## 0.3.0

- Fixed void tags such as `input` so they always format as self-closing, even when `closingStyle` is set to `explicit`
- Removed duplicate closing-tag output for void elements written with explicit end tags such as `<input></input>`
- Centralized the shared void-tag list into a dedicated utility used by both the tokenizer and formatter

## 0.2.0

- Improved config discovery so nested projects can resolve the nearest `html-formatter.config.jsonc` between the active document and the workspace root
- Fixed JSONC parsing for inline `//` comments inside formatter config files
- Added `attributeLayout` support to `knownTagDefaults` and per-tag rules with `preserve`, `multi-line`, and `single-line` modes
- Added `maxAttributeLineWidth` to wrap `single-line` attribute layouts once the configured total width would be exceeded
- Registered formatting for `*.html` files through the file-pattern selector
- Expanded automated test coverage for config lookup and JSONC parsing
- Split the formatter test suite into focused files with shared test helpers
- Added a publishing guide for packaging and releasing the extension

## 0.1.0

- VS Code formatter for HTML and Angular templates
- Project-based shared config through `html-formatter.config.jsonc`
- Indentation-only behavior for tags not configured in `tags`
- Tag-specific formatting rules for known components such as `p-select`
- Attribute ordering with Angular-friendly matching for plain attributes, bindings, events, two-way bindings, structural directives, and template refs
- Configurable handling for unknown attributes through `unknownAttributesPosition` and `sortUnknownAttributes`
- Configurable closing behavior through `closingStyle`, `closingBracketPosition`, and `closingTagPosition`
- Line-preserving formatting without automatic wrapping or reflow
- Indentation support for Angular control flow such as `@if`, `@else`, `@for`, `@switch`, and related block syntax
- Support for both `Format Document` and `Format Selection`
- Commands for formatting, config validation, and showing the active config
- Local VSIX packaging support
- Automated test coverage for formatter behavior and config handling
