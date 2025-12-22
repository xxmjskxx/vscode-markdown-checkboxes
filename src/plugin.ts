import type MarkdownIt from 'markdown-it';

export interface CheckboxPluginOptions {
	enabled: boolean;
	label: boolean;
	labelAfter: boolean;
	enableTableCheckboxes: boolean;
	enableExtendedStates: boolean;
	persistPreviewChanges: boolean;
}

function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function isLikelyListItemPrefix(prefix: string): boolean {
	// Matches: "- ", "* ", "+ ", "1. ", "1) " (with optional indent)
	return /^\s*(?:[-+*]|\d+[.)])\s+$/.test(prefix);
}

function isLikelyTableRow(line: string): boolean {
	// Heuristic: must contain at least two pipes and not be an hr/divider-only line.
	// This intentionally keeps the check simple; VS Code enables table parsing by default.
	const pipeCount = (line.match(/\|/g) ?? []).length;
	if (pipeCount < 2) {
		return false;
	}
	// Exclude common table separator rows: | --- | --- |
	if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) {
		return false;
	}
	return true;
}

function stateToClasses(state: string): { stateClass: string; ariaChecked: 'true' | 'false' | 'mixed' } {
	const normalized = state.toLowerCase();
	switch (normalized) {
		case 'x':
			return { stateClass: 'is-checked', ariaChecked: 'true' };
		case '~':
			return { stateClass: 'is-wip', ariaChecked: 'mixed' };
		case '-':
			return { stateClass: 'is-cancelled', ariaChecked: 'mixed' };
		case ' ':
		default:
			return { stateClass: 'is-unchecked', ariaChecked: 'false' };
	}
}

export function checklistPlugin(md: MarkdownIt, getOptions: () => CheckboxPluginOptions): void {
	const pattern = /^\[([ xX~-])\](?=\s|$)/;

	md.inline.ruler.before('emphasis', 'markdown-checkboxes', (state, silent) => {
		const options = getOptions();
		if (!options.enabled) {
			return false;
		}

		if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) {
			return false;
		}

		const match = pattern.exec(state.src.slice(state.pos));
		if (!match) {
			return false;
		}

		// Gate matching to keep default behavior unchanged:
		// - Always allow at the start of list items
		// - Only allow in tables when enableTableCheckboxes is true
		const bol = state.src.lastIndexOf('\n', state.pos - 1) + 1;
		const eolIndex = state.src.indexOf('\n', state.pos);
		const eol = eolIndex === -1 ? state.src.length : eolIndex;
		const prefix = state.src.slice(bol, state.pos);
		const line = state.src.slice(bol, eol);

		const isListItem = isLikelyListItemPrefix(prefix);
		const isTable = options.enableTableCheckboxes && isLikelyTableRow(line);
		if (!isListItem && !isTable) {
			return false;
		}

		const rawState = match[1];
		const normalizedState = rawState === 'X' ? 'x' : rawState;

		if (!options.enableExtendedStates && (normalizedState === '~' || normalizedState === '-')) {
			return false;
		}

		// When persistence is disabled, we only want to handle:
		// - custom states in lists (since markdown-it-task-lists already handles [ ]/[x])
		// - any states in tables (because task-lists does not handle tables)
		if (!options.persistPreviewChanges) {
			if (isListItem && (normalizedState === ' ' || normalizedState.toLowerCase() === 'x')) {
				return false;
			}
		}

		if (silent) {
			return true;
		}

		const token = state.push('markdown_checkbox', '', 0);
		token.meta = {
			offset: state.pos,
			state: normalizedState,
		};

		state.pos += match[0].length;
		return true;
	});

	md.core.ruler.after('inline', 'markdown-checkboxes-list-classes', (state) => {
		const options = getOptions();
		if (!options.enabled) {
			return false;
		}

		const tokens = state.tokens;
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (token.type !== 'inline' || !token.children) {
				continue;
			}

			if (!token.children.some(child => child.type === 'markdown_checkbox')) {
				continue;
			}

			// Add the same classes markdown-it-task-lists uses for list styling.
			// Find nearest list_item_open and list_open before this inline token.
			for (let j = i; j >= 0; j--) {
				const t = tokens[j];
				if (t.type === 'list_item_open') {
					const existing = t.attrGet('class') ?? '';
					if (!existing.split(/\s+/).includes('task-list-item')) {
						t.attrSet('class', (existing ? existing + ' ' : '') + 'task-list-item');
					}
					break;
				}
				if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
					break;
				}
			}

			for (let j = i; j >= 0; j--) {
				const t = tokens[j];
				if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
					const existing = t.attrGet('class') ?? '';
					if (!existing.split(/\s+/).includes('contains-task-list')) {
						t.attrSet('class', (existing ? existing + ' ' : '') + 'contains-task-list');
					}
					break;
				}
			}
		}

		return false;
	});

	md.renderer.rules.markdown_checkbox = (tokens, idx, _options, env) => {
		const options = getOptions();
		const meta = (tokens[idx].meta ?? {}) as { offset?: number; state?: string };
		const offset = typeof meta.offset === 'number' ? meta.offset : -1;
		const stateChar = typeof meta.state === 'string' ? meta.state : ' ';
		const { stateClass, ariaChecked } = stateToClasses(stateChar);

		// Best-effort to identify the originating document for persistence.
		const envPath = (env as any)?.path ?? (env as any)?.filePath ?? (env as any)?.sourceFile;
		const uri = typeof envPath === 'string' ? envPath : '';

		if (options.persistPreviewChanges) {
			const args = encodeURIComponent(JSON.stringify({ uri, offset }));
			return `<a class="task-list-item-checkbox ${stateClass}" href="command:mjsk-markdown-checkboxes.toggle?${args}" data-offset="${offset}" role="checkbox" aria-checked="${ariaChecked}" title="Toggle checkbox"></a>`;
		}

		// Non-persistent rendering:
		// - Keep native inputs for [ ]/[x] to match the built-in preview.
		// - Render custom states as spans with CSS icons.
		if (stateChar === ' ' || stateChar.toLowerCase() === 'x') {
			const checkedAttr = stateChar.toLowerCase() === 'x' ? ' checked="checked"' : '';
			return `<input class="task-list-item-checkbox" type="checkbox" disabled="disabled"${checkedAttr}>`;
		}

		return `<span class="task-list-item-checkbox ${stateClass}" role="checkbox" aria-checked="${ariaChecked}" title="Checkbox"></span>`;
	};
}
