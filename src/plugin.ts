import type MarkdownIt from 'markdown-it';

export interface CheckboxPluginOptions {
	enabled: boolean;
	label: boolean;
	labelAfter: boolean;
	enableTableCheckboxes: boolean;
	enableExtendedStates: boolean;
	persistPreviewChanges: boolean;
}

const EXTENSION_ID = 'xxmjskxx.mjsk-markdown-checkboxes';

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


function stateToGlyph(state: string): string {
	const normalized = state.toLowerCase();
	switch (normalized) {
		case 'x':
			return '☑';
		case '~':
			return '⊡';
		case '-':
			return '⊟';
		case ' ':
		default:
			return '☐';
	}
}

function normalizeStateChar(raw: string): ' ' | 'x' | '~' | '-' {
	if (raw === 'X' || raw === 'x') {
		return 'x';
	}
	if (raw === '~') {
		return '~';
	}
	if (raw === '-') {
		return '-';
	}
	return ' ';
}

function isStandardCheckbox(stateChar: string): boolean {
	return stateChar === ' ' || stateChar.toLowerCase() === 'x';
}

function makeCheckboxHtml(stateChar: string, persist: boolean, args?: string): string {
	const normalized = normalizeStateChar(stateChar);
	if (isStandardCheckbox(normalized)) {
		const checkedAttr = normalized === 'x' ? ' checked=""' : '';
		const input = `<input class="task-list-item-checkbox" disabled="" type="checkbox"${checkedAttr}>`;
		if (persist && args) {
			return `<a class="task-list-item-checkbox-link" href="vscode://${EXTENSION_ID}/toggle?args=${args}" title="Toggle checkbox">${input}</a>`;
		}
		return input;
	}

	const glyph = stateToGlyph(normalized);
	const { stateClass, ariaChecked } = stateToClasses(normalized);
	const span = `<span class="task-list-item-checkbox ${stateClass}" role="checkbox" aria-checked="${ariaChecked}">${glyph}</span>`;
	if (persist && args) {
		return `<a class="task-list-item-checkbox-link" href="vscode://${EXTENSION_ID}/toggle?args=${args}" title="Toggle checkbox">${span}</a>`;
	}
	return span;
}

function replaceCheckboxesInText(text: string, makeNode: (stateChar: string) => Array<any>): Array<any> {
	// Matches [ ], [x], [X], [~], [-] that are followed by space or end-of-string.
	const regex = /\[([ xX~-])\](?=\s|$)/g;
	const nodes: Array<any> = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(text))) {
		if (match.index > lastIndex) {
			nodes.push({ type: 'text', content: text.slice(lastIndex, match.index) });
		}
		nodes.push(...makeNode(match[1]));
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < text.length) {
		nodes.push({ type: 'text', content: text.slice(lastIndex) });
	}
	return nodes;
}

export function checklistPlugin(md: MarkdownIt, getOptions: () => CheckboxPluginOptions): void {
	md.core.ruler.after('inline', 'mjsk-markdown-checkboxes', (state) => {
		const options = getOptions();
		if (!options.enabled) {
			return false;
		}

		// Track whether we're inside a table while walking the token stream.
		let tableDepth = 0;
		// Occurrence counter per source line (used for persistence).
		const perLineIndex = new Map<number, number>();

		const tokens = state.tokens;
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (token.type === 'table_open') {
				tableDepth++;
				continue;
			}
			if (token.type === 'table_close') {
				tableDepth = Math.max(0, tableDepth - 1);
				continue;
			}

			const inTable = tableDepth > 0;
			if (!token.children || token.type !== 'inline') {
				continue;
			}

			const startLine = Array.isArray(token.map) ? token.map[0] : undefined;
			const sourceLine = typeof startLine === 'number' ? startLine : -1;

			const envPath = (state.env as any)?.path ?? (state.env as any)?.filePath ?? (state.env as any)?.sourceFile;
			const uri = typeof envPath === 'string' ? envPath : '';

			const makeArgsFor = () => {
				if (!options.persistPreviewChanges || sourceLine < 0) {
					return undefined;
				}
				const current = perLineIndex.get(sourceLine) ?? 0;
				perLineIndex.set(sourceLine, current + 1);
				// This will be parsed by the extension's UriHandler.
				return encodeURIComponent(JSON.stringify({ uri, line: sourceLine, index: current }));
			};

			// 1) List item checkbox at start of list item text (GitHub style)
			// We do this ourselves when persistence is enabled OR when extended states are enabled.
			const isListTodo =
				i >= 2 &&
				tokens[i - 1]?.type === 'paragraph_open' &&
				tokens[i - 2]?.type === 'list_item_open' &&
				(token.content.startsWith('[ ]') || token.content.startsWith('[x]') || token.content.startsWith('[X]') || token.content.startsWith('[-]') || token.content.startsWith('[~]'));

			if (isListTodo) {
				const raw = token.content[1];
				const stateChar = normalizeStateChar(raw);
				const isExtended = stateChar === '~' || stateChar === '-';
				if (isExtended && !options.enableExtendedStates) {
					// Leave it as text when extended states are disabled.
				} else {
					// Preserve original behavior when persistence is off for standard [ ]/[x]
					// by letting markdown-it-task-lists handle it.
					if (options.persistPreviewChanges || isExtended) {
						const args = makeArgsFor();
						const html = makeCheckboxHtml(stateChar, options.persistPreviewChanges, args);
						const checkboxToken = new state.Token('html_inline', '', 0);
						checkboxToken.content = html;

						// Insert checkbox token at start and remove the markdown marker.
						token.children.unshift(checkboxToken);
						// token.children[1] is the first original child after unshift.
						if (token.children[1]?.type === 'text' && typeof token.children[1].content === 'string') {
								token.children[1].content = token.children[1].content.slice(3);
						}
							token.content = token.content.slice(3);

						// Add list classes to match GitHub markup.
						const li = tokens[i - 2];
						const liExisting = li.attrGet('class') ?? '';
						if (!liExisting.split(/\s+/).includes('task-list-item')) {
							li.attrSet('class', (liExisting ? liExisting + ' ' : '') + 'task-list-item');
						}
						// Mark the nearest list as contains-task-list
						for (let j = i - 2; j >= 0; j--) {
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
				}
				continue;
			}

			// 2) Table (and other inline) checkbox replacement, controlled by enableTableCheckboxes
			if (!inTable || !options.enableTableCheckboxes) {
				continue;
			}

			const newChildren: any[] = [];
			for (const child of token.children) {
				if (child.type !== 'text' || typeof child.content !== 'string') {
					newChildren.push(child);
					continue;
				}

				const parts = replaceCheckboxesInText(child.content, (rawState) => {
					const stateChar = normalizeStateChar(rawState);
					const isExtended = stateChar === '~' || stateChar === '-';
					if (isExtended && !options.enableExtendedStates) {
						return [{ type: 'text', content: `[${rawState}]` }];
					}
					const args = makeArgsFor();
					const html = makeCheckboxHtml(stateChar, options.persistPreviewChanges, args);
					return [{ type: 'html_inline', content: html }];
				});

				for (const part of parts) {
					const t = new state.Token(part.type, '', 0);
					t.content = part.content;
					newChildren.push(t);
				}
			}
			token.children = newChildren;
		}

		return false;
	});
}
