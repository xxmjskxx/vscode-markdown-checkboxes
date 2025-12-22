Adds checkbox / task list support to VS Code's built-in markdown preview and in notebooks:

![](https://raw.githubusercontent.com/xxmjskxx/vscode-markdown-checkboxes/master/docs/example.png)

# Features 
- Adds support for Github's `- [ ]` and `- [x]` check box syntax  to VS Code's built-in markdown preview.
- Adds `- [ ]` and `- [x]` checkbox rendering Markdown cells in notebooks.

## Additional checkbox states

This extension can also render these checkbox states:

- `[-]` (cancelled)
- `[~]` (in progress)

By default, these are disabled (see `mjsk-markdown-checkboxes.enableExtendedStates`).

## Options

These settings are under **Mjsk Markdown Checkboxes Options**:

- `mjsk-markdown-checkboxes.enableTableCheckboxes` (default: `false`)
	- When enabled, renders checkboxes inside tables such as `| task | [ ] |`.
	- When disabled, checkbox parsing stays list-only (GitHub-style `- [ ]`).

- `mjsk-markdown-checkboxes.enableExtendedStates` (default: `false`)
	- Enables rendering of `[~]` (in progress) and `[-]` (cancelled).

- `mjsk-markdown-checkboxes.persistPreviewChanges` (default: `false`)
	- When enabled, clicking a checkbox in the preview updates the source markdown file.
	- Note: VS Code may prompt to open the `vscode://` link the first time.

- `mjsk-markdown-checkboxes.persistPreviewToggleCycle` (default: `[]`)
	- Optional ordered list of states to cycle through on click when persistence is enabled.
	- Allowed values: `unchecked`, `checked`, `wip`, `cancelled`.
	- Example: `["unchecked", "wip", "checked", "cancelled"]`.

### Recommended settings

Enable table checkboxes + preview-click persistence, and cycle through all states:

```json
{
	"mjsk-markdown-checkboxes.enable": true,
	"mjsk-markdown-checkboxes.enableTableCheckboxes": true,
	"mjsk-markdown-checkboxes.enableExtendedStates": true,
	"mjsk-markdown-checkboxes.persistPreviewChanges": true,
	"mjsk-markdown-checkboxes.persistPreviewToggleCycle": [
		"unchecked",
		"wip",
		"checked",
		"cancelled"
	]
}
```
