# Changelog

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
