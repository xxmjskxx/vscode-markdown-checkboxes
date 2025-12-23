import type MarkdownIt from 'markdown-it';

export interface CheckboxPluginOptions {
	enabled: boolean;
	label: boolean;
	labelAfter: boolean;
	enableTableCheckboxes: boolean;
	enableExtendedStates: boolean;
	persistPreviewChanges: boolean;
	persistPreviewToggleCycle: Array<'unchecked' | 'checked' | 'wip' | 'cancelled'>;
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
			return '';
		case '-':
			return '';
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

function stateCharToName(stateChar: string): 'unchecked' | 'checked' | 'wip' | 'cancelled' {
	const c = stateChar.toLowerCase();
	if (c === 'x') {
		return 'checked';
	}
	if (c === '~') {
		return 'wip';
	}
	if (c === '-') {
		return 'cancelled';
	}
	return 'unchecked';
}

function stateNameToChar(name: 'unchecked' | 'checked' | 'wip' | 'cancelled'): ' ' | 'x' | '~' | '-' {
	switch (name) {
		case 'checked':
			return 'x';
		case 'wip':
			return '~';
		case 'cancelled':
			return '-';
		case 'unchecked':
		default:
			return ' ';
	}
}

function computeNextState(current: ' ' | 'x' | '~' | '-', options: CheckboxPluginOptions): ' ' | 'x' | '~' | '-' {
	let cycle = Array.isArray(options.persistPreviewToggleCycle) ? options.persistPreviewToggleCycle : [];
	if (!options.enableExtendedStates) {
		cycle = cycle.filter(s => s === 'unchecked' || s === 'checked');
	}
	if (cycle.length >= 2) {
		const currentName = stateCharToName(current);
		const idx = cycle.indexOf(currentName);
		const nextName = cycle[(idx === -1 ? 0 : (idx + 1) % cycle.length)];
		return stateNameToChar(nextName);
	}

	// Default:
	// - unchecked <-> checked
	// - wip -> checked
	// - cancelled -> unchecked
	const c = current.toLowerCase();
	if (c === ' ') {
		return 'x';
	}
	if (c === 'x') {
		return ' ';
	}
	if (c === '~') {
		return 'x';
	}
	if (c === '-') {
		return ' ';
	}
	return 'x';
}

function isStandardCheckbox(stateChar: string): boolean {
	return stateChar === ' ' || stateChar.toLowerCase() === 'x';
}

function makeCheckboxHtml(stateChar: string, persist: boolean, args?: string): string {
	const normalized = normalizeStateChar(stateChar);
	// In persistence mode, always render CSS-drawn spans (not native <input>) to:
	// - avoid inline scripts/event handlers (can trigger Markdown preview security banner)
	// - avoid native checkbox DOM state restoration causing visual desync after tab switches
	if (persist && args) {
		const { stateClass, ariaChecked } = stateToClasses(normalized);
		const span = `<span class="task-list-item-checkbox ${stateClass}" role="checkbox" aria-checked="${ariaChecked}"></span>`;
		return `<a class="task-list-item-checkbox-link" href="vscode://${EXTENSION_ID}/toggle?args=${args}" title="Toggle checkbox">${span}</a>`;
	}

	if (isStandardCheckbox(normalized)) {
		const checkedAttr = normalized === 'x' ? ' checked=""' : '';
		const input = `<input class="task-list-item-checkbox" disabled="" type="checkbox"${checkedAttr}>`;
		return input;
	}

	const { stateClass, ariaChecked } = stateToClasses(normalized);
	// Extended states render as an empty box with CSS-drawn indicators.
	return `<span class="task-list-item-checkbox ${stateClass}" role="checkbox" aria-checked="${ariaChecked}"></span>`;
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

function findNearestSourceLine(tokens: any[], fromIndex: number): number {
	for (let i = fromIndex; i >= 0; i--) {
		const map = tokens[i]?.map;
		if (Array.isArray(map) && typeof map[0] === 'number') {
			return map[0];
		}
	}
	return -1;
}

export function checklistPlugin(md: MarkdownIt, getOptions: () => CheckboxPluginOptions): void {
	md.core.ruler.after('inline', 'mjsk-markdown-checkboxes', (state) => {
		const options = getOptions();
		if (!options.enabled) {
			return false;
		}

		// Track whether we're inside a table while walking the token stream.
		let tableDepth = 0;
		// Document-global checkbox counter (used for persistence).
		let globalIndex = 0;

		const tokens = state.tokens;
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			
			// Skip code fence content
			if (token.type === 'fence' || token.type === 'code_block') {
				continue;
			}
			
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
			let sourceLine = typeof startLine === 'number' ? startLine : -1;
			if (sourceLine < 0) {
				sourceLine = findNearestSourceLine(tokens as any[], i);
			}

			// VS Code's markdown preview passes document info in env - try multiple possible properties
			const env = state.env as any;
			let uri = '';
			
			// Try various properties VS Code might use
			const possiblePaths = [
				env?.currentDocument?.uri?.fsPath,
				env?.currentDocument?.uri?.toString?.(),
				env?.currentDocument,
				env?.documentUri?.fsPath,
				env?.documentUri?.toString?.(),
				env?.documentUri,
				env?.resourcePath,
				env?.path,
				env?.filePath,
				env?.sourceFile,
			];
			
			for (const p of possiblePaths) {
				if (typeof p === 'string' && p.length > 0) {
					uri = p;
					break;
				}
			}

			const makeArgsFor = () => {
				if (!options.persistPreviewChanges) {
					return undefined;
				}
				const args = {
					uri,
					indexGlobal: globalIndex,
					// Keep best-effort line info for debugging/fallbacks.
					line: sourceLine,
				};
				globalIndex++;
				// This will be parsed by the extension's UriHandler.
				return encodeURIComponent(JSON.stringify(args));
			};

			const makeArgsForState = (currentStateChar: ' ' | 'x' | '~' | '-') => {
				if (!options.persistPreviewChanges) {
					return undefined;
				}
				const nextStateChar = computeNextState(currentStateChar, options);
				const args = {
					uri,
					indexGlobal: globalIndex,
					line: sourceLine,
					state: currentStateChar,
					next: nextStateChar,
					extended: !!options.enableExtendedStates,
					cycle: Array.isArray(options.persistPreviewToggleCycle) ? options.persistPreviewToggleCycle : [],
				};
				globalIndex++;
				return encodeURIComponent(JSON.stringify(args));
			};

			// 1) List item checkbox at start of list item text (GitHub style)
			// We do this ourselves when persistence is enabled OR when extended states are enabled.
			const isListTodo =
				i >= 2 &&
				tokens[i - 1]?.type === 'paragraph_open' &&
				tokens[i - 2]?.type === 'list_item_open' &&
				(token.content.startsWith('[ ]') || token.content.startsWith('[x]') || token.content.startsWith('[X]') || token.content.startsWith('[-]') || token.content.startsWith('[~]'));

			if (isListTodo) {
				// Inline tokens frequently do not have a `map`, but the paragraph token does.
				if (sourceLine < 0) {
					const paragraphMap = tokens[i - 1]?.map;
					if (Array.isArray(paragraphMap) && typeof paragraphMap[0] === 'number') {
						sourceLine = paragraphMap[0];
					}
				}

				const raw = token.content[1];
				const stateChar = normalizeStateChar(raw);
				const isExtended = stateChar === '~' || stateChar === '-';
				if (isExtended && !options.enableExtendedStates) {
					// Leave it as text when extended states are disabled.
				} else {
					// Preserve original behavior when persistence is off for standard [ ]/[x]
					// by letting markdown-it-task-lists handle it.
					if (options.persistPreviewChanges || isExtended) {
						const args = makeArgsForState(stateChar);
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
					const args = makeArgsForState(stateChar);
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
