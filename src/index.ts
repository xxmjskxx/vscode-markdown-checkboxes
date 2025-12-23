import * as vscode from 'vscode';
import * as taskList from 'markdown-it-task-lists';
import type MarkdownIt from 'markdown-it';

import { checklistPlugin, type CheckboxPluginOptions } from './plugin';

const EXTENSION_ID = 'xxmjskxx.mjsk-markdown-checkboxes';

function getOptions(): CheckboxPluginOptions {
    const config = vscode.workspace.getConfiguration('mjsk-markdown-checkboxes');
    const legacyConfig = vscode.workspace.getConfiguration('markdown-checkboxes');
    return {
        enabled: config.get<boolean>('enable', legacyConfig.get<boolean>('enable', true)),
        label: config.get<boolean>('label', legacyConfig.get<boolean>('label', false)),
        labelAfter: config.get<boolean>('labelAfter', legacyConfig.get<boolean>('labelAfter', false)),
        enableTableCheckboxes: config.get<boolean>('enableTableCheckboxes', legacyConfig.get<boolean>('enableTableCheckboxes', false)),
        enableExtendedStates: config.get<boolean>('enableExtendedStates', legacyConfig.get<boolean>('enableExtendedStates', false)),
        persistPreviewChanges: config.get<boolean>('persistPreviewChanges', legacyConfig.get<boolean>('persistPreviewChanges', false)),
    };
}

type CheckboxStateName = 'unchecked' | 'checked' | 'wip' | 'cancelled';

function readPersistCycle(): CheckboxStateName[] {
    const config = vscode.workspace.getConfiguration('mjsk-markdown-checkboxes');
    const legacyConfig = vscode.workspace.getConfiguration('markdown-checkboxes');
    const raw = config.get<unknown>('persistPreviewToggleCycle', legacyConfig.get<unknown>('persistPreviewToggleCycle', []));
    if (!Array.isArray(raw)) {
        return [];
    }
    const allowed = new Set<CheckboxStateName>(['unchecked', 'checked', 'wip', 'cancelled']);
    const result: CheckboxStateName[] = [];
    for (const item of raw) {
        if (typeof item !== 'string') {
            continue;
        }
        const v = item as CheckboxStateName;
        if (!allowed.has(v)) {
            continue;
        }
        result.push(v);
    }
    return result;
}

function stateCharToName(stateChar: string): CheckboxStateName {
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

function stateNameToChar(name: CheckboxStateName): string {
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

async function resolveTargetDocumentUri(rawUri: unknown): Promise<vscode.Uri | undefined> {
    if (typeof rawUri !== 'string' || !rawUri) {
        return undefined;
    }

    try {
        // markdown preview usually gives us a filesystem path
        if (/^[a-zA-Z]:\\/.test(rawUri) || rawUri.startsWith('/') || rawUri.startsWith('\\\\')) {
            return vscode.Uri.file(rawUri);
        }
        return vscode.Uri.parse(rawUri);
    } catch {
        return undefined;
    }
}

type ToggleArgs = {
    uri?: unknown;
    offset?: unknown;
    line?: unknown;
    inlinePos?: unknown;
    index?: unknown;
	indexGlobal?: unknown;
};

function parseToggleArgsFromUri(uri: vscode.Uri): ToggleArgs {
    const q = new URLSearchParams(uri.query);
    const raw = q.get('args');
    if (!raw) {
        return {};
    }
    try {
        return JSON.parse(decodeURIComponent(raw)) as ToggleArgs;
    } catch {
        return {};
    }
}

/**
 * Count how many eligible checkboxes exist in a markdown document text,
 * excluding those inside fenced code blocks or inline backticks.
 */
function countCheckboxesInDocument(text: string): number {
    const lines = text.split(/\r?\n/);
    let count = 0;
    let inFence = false;
    const fencePattern = /^```/;
    const checkboxPattern = /\[([ xX~-])\](?=\s|$)/g;

    for (const line of lines) {
        if (fencePattern.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }
        // Remove inline backtick spans
        const cleaned = line.replace(/`[^`]*`/g, match => ' '.repeat(match.length));
        let m: RegExpExecArray | null;
        while ((m = checkboxPattern.exec(cleaned)) !== null) {
            count++;
        }
    }
    return count;
}

let _output: vscode.OutputChannel | undefined;
function getOutput(): vscode.OutputChannel {
    if (!_output) {
        _output = vscode.window.createOutputChannel('Mjsk Markdown Checkboxes');
    }
    return _output;
}

async function applyToggleFromArgs(args: ToggleArgs): Promise<void> {
    const output = getOutput();
    const options = getOptions();
    output.appendLine(`[toggle] args=${JSON.stringify(args)}`);
    output.appendLine(`[toggle] options=${JSON.stringify(options)}`);
    if (!options.persistPreviewChanges) {
        output.appendLine('[toggle] persistPreviewChanges is disabled');
        return;
    }

    async function refreshMarkdownPreview(targetUri: vscode.Uri): Promise<void> {
        // Try the most reliable refresh methods first
        const commandsToTry: Array<{ id: string; args: any[] }> = [
            // Primary: explicit refresh commands
            { id: 'markdown.preview.refresh', args: [] },
            // Fallback: reopen the preview (forces full re-render)
            { id: 'markdown.showPreview', args: [targetUri] },
        ];

        for (const c of commandsToTry) {
            try {
                await vscode.commands.executeCommand(c.id, ...c.args);
                output.appendLine(`[refresh] executed ${c.id}`);
                return;
            } catch (e) {
                output.appendLine(`[refresh] ${c.id} failed: ${e}`);
            }
        }
    }

    let uri = await resolveTargetDocumentUri(args?.uri);
    const legacyOffset = typeof args?.offset === 'number' ? (args.offset as number) : undefined;
    const lineNumber = typeof args?.line === 'number' ? (args.line as number) : undefined;
    const inlinePos = typeof args?.inlinePos === 'number' ? (args.inlinePos as number) : undefined;
    const occurrenceIndex = typeof args?.index === 'number' ? (args.index as number) : undefined;
    const globalIndex = typeof args?.indexGlobal === 'number' ? (args.indexGlobal as number) : undefined;

    if (!uri) {
        // Try active text editor first
        const active = vscode.window.activeTextEditor?.document;
        if (active && (active.languageId === 'markdown' || active.fileName.endsWith('.md'))) {
            uri = active.uri;
            output.appendLine(`[toggle] fallback to activeTextEditor uri=${uri.toString(true)}`);
        }
    }

    if (!uri) {
        // Fallback: find any visible markdown editor
        for (const editor of vscode.window.visibleTextEditors) {
            const doc = editor.document;
            if (doc.languageId === 'markdown' || doc.fileName.endsWith('.md')) {
                uri = doc.uri;
                output.appendLine(`[toggle] fallback to visible editor uri=${uri.toString(true)}`);
                break;
            }
        }
    }

    if (!uri) {
        // Fallback: search ALL open text documents (includes non-visible ones)
        const markdownDocs = vscode.workspace.textDocuments.filter(
            doc => doc.languageId === 'markdown' || doc.fileName.endsWith('.md')
        );
        output.appendLine(`[toggle] found ${markdownDocs.length} open markdown docs`);
        if (markdownDocs.length === 1) {
            uri = markdownDocs[0].uri;
            output.appendLine(`[toggle] fallback to only open markdown doc uri=${uri.toString(true)}`);
        } else if (markdownDocs.length > 1) {
            // Multiple markdown docs open - find the one where a checkbox exists at the line hint
            const lineHint = typeof args?.line === 'number' ? args.line : -1;
            const globalIdx = typeof args?.indexGlobal === 'number' ? args.indexGlobal : -1;
            const checkboxPattern = /\[([ xX~-])\]/;
            
            for (const doc of markdownDocs) {
                // First check: line hint must be valid for this doc
                if (lineHint < 0 || lineHint >= doc.lineCount) {
                    continue;
                }
                // Second check: line at lineHint should contain a checkbox pattern
                const lineText = doc.lineAt(lineHint).text;
                if (!checkboxPattern.test(lineText)) {
                    output.appendLine(`[toggle] doc ${doc.fileName} line ${lineHint} has no checkbox`);
                    continue;
                }
                // Third check: count checkboxes and verify globalIdx exists in this doc
                if (globalIdx >= 0) {
                    const docText = doc.getText();
                    const count = countCheckboxesInDocument(docText);
                    if (globalIdx >= count) {
                        output.appendLine(`[toggle] doc ${doc.fileName} has only ${count} checkboxes, need #${globalIdx}`);
                        continue;
                    }
                }
                uri = doc.uri;
                output.appendLine(`[toggle] matched doc with checkbox at line ${lineHint}: ${uri.toString(true)}`);
                break;
            }
            // If still no match, just use the first one
            if (!uri) {
                uri = markdownDocs[0].uri;
                output.appendLine(`[toggle] fallback to first markdown doc uri=${uri.toString(true)}`);
            }
        }
    }

    if (!uri) {
        output.appendLine('[toggle] no target uri - no markdown document found');
        return;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    output.appendLine(`[toggle] opened=${document.uri.toString(true)}`);

    function isTableSeparatorLine(text: string): boolean {
        return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(text);
    }

    function isTableLine(text: string): boolean {
        const pipeCount = (text.match(/\|/g) ?? []).length;
        if (pipeCount < 2) {
            return false;
        }
        if (isTableSeparatorLine(text)) {
            return false;
        }
        return true;
    }

    function isListLine(text: string): boolean {
        return /^\s*(?:[-+*]|\d+[.)])\s+/.test(text);
    }

    function findNthEligibleCheckbox(n: number): { line: number; matchIndex: number; state: string } | undefined {
        let count = 0;
        let inCodeFence = false;
        
        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;
            
            // Track code fence state - skip content inside ``` blocks
            if (/^\s*```/.test(text)) {
                inCodeFence = !inCodeFence;
                continue;
            }
            if (inCodeFence) {
                continue;
            }

            const eligibleList = isListLine(text);
            const eligibleTable = options.enableTableCheckboxes && isTableLine(text);
            if (!eligibleList && !eligibleTable) {
                continue;
            }

            // Remove inline code (backtick content) before searching for checkboxes
            // This prevents matching [ ] inside `code` spans
            const textWithoutInlineCode = text.replace(/`[^`]*`/g, match => ' '.repeat(match.length));

            const checkboxRegex = /\[([ xX~-])\]/g;
            let match: RegExpExecArray | null;
            while ((match = checkboxRegex.exec(textWithoutInlineCode))) {
                const state = match[1];
                const normalized = state.toLowerCase();
                const isExtended = normalized === '~' || normalized === '-';
                if (isExtended && !options.enableExtendedStates) {
                    continue;
                }
                if (count === n) {
                    output.appendLine(`[toggle] found checkbox #${n} at line ${line}: "${text.substring(0, 50)}..."`);
                    return { line, matchIndex: match.index, state };
                }
                count++;
            }
        }
        output.appendLine(`[toggle] searched ${count} checkboxes, did not find #${n}`);
        return undefined;
    }

    if (typeof globalIndex === 'number' && globalIndex >= 0) {
        const target = findNthEligibleCheckbox(globalIndex);
        if (!target) {
            output.appendLine(`[toggle] indexGlobal=${globalIndex} not found`);
            return;
        }

        const replaceStart = new vscode.Position(target.line, target.matchIndex + 1);
        const replaceEnd = new vscode.Position(target.line, target.matchIndex + 2);
        const next = computeNextState(target.state, options.enableExtendedStates);

        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, new vscode.Range(replaceStart, replaceEnd), next);
        await vscode.workspace.applyEdit(edit);
        try {
            await document.save();
        } catch {
            // ignore
        }
        output.appendLine(`[toggle] toggled indexGlobal=${globalIndex} at line=${target.line}`);
        await refreshMarkdownPreview(uri);
        return;
    }

    // Preferred targeting: (line, index) where index is the Nth rendered checkbox on that line.
    if (typeof lineNumber === 'number' && lineNumber >= 0 && typeof occurrenceIndex === 'number' && occurrenceIndex >= 0) {
        if (lineNumber >= document.lineCount) {
            return;
        }

        const line = document.lineAt(lineNumber);
        const checkboxRegex = /\[([ xX~-])\]/g;

        let match: RegExpExecArray | null;
        let current = 0;
        let target: { index: number; state: string } | undefined;

        while ((match = checkboxRegex.exec(line.text))) {
            const state = match[1];
            const normalized = state.toLowerCase();
            const isExtended = normalized === '~' || normalized === '-';

            if (isExtended && !options.enableExtendedStates) {
                continue;
            }

            if (current === occurrenceIndex) {
                target = { index: match.index, state };
                break;
            }
            current++;
        }

        if (!target) {
            return;
        }

        const replaceStart = new vscode.Position(lineNumber, target.index + 1);
        const replaceEnd = new vscode.Position(lineNumber, target.index + 2);
        const next = computeNextState(target.state, options.enableExtendedStates);

        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, new vscode.Range(replaceStart, replaceEnd), next);
        await vscode.workspace.applyEdit(edit);
        try {
            await document.save();
        } catch {
            // ignore
        }
        await refreshMarkdownPreview(uri);
        return;
    }

    // New targeting: (line, inlinePos)
    if (typeof lineNumber === 'number' && lineNumber >= 0 && typeof inlinePos === 'number' && inlinePos >= 0) {
        if (lineNumber >= document.lineCount) {
            return;
        }
        const line = document.lineAt(lineNumber);
        const checkboxRegex = /\[([ xX~-])\]/g;

        let match: RegExpExecArray | null;
        let bestMatch: { index: number; state: string; distance: number } | undefined;

        while ((match = checkboxRegex.exec(line.text))) {
            const state = match[1];
            const index = match.index;
            const distance = Math.abs(index - inlinePos);
            if (!bestMatch || distance < bestMatch.distance) {
                bestMatch = { index, state, distance };
            }
        }

        if (!bestMatch) {
            return;
        }

        if (!options.enableExtendedStates && (bestMatch.state === '~' || bestMatch.state === '-')) {
            return;
        }

        const replaceStart = new vscode.Position(lineNumber, bestMatch.index + 1);
        const replaceEnd = new vscode.Position(lineNumber, bestMatch.index + 2);
        const next = computeNextState(bestMatch.state, options.enableExtendedStates);

        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, new vscode.Range(replaceStart, replaceEnd), next);
        await vscode.workspace.applyEdit(edit);
        return;
    }

    // Legacy targeting: absolute offset in document (best-effort)
    if (typeof legacyOffset !== 'number' || legacyOffset < 0) {
        return;
    }

    const anchorPos = document.positionAt(legacyOffset);
    const line = document.lineAt(anchorPos.line);
    const lineStartOffset = document.offsetAt(line.range.start);

    const checkboxRegex = /\[([ xX~-])\]/g;
    let match: RegExpExecArray | null;
    let bestMatch: { index: number; state: string } | undefined;

    while ((match = checkboxRegex.exec(line.text))) {
        const startIndex = match.index;
        const endIndexExclusive = startIndex + match[0].length;
        const absoluteStart = lineStartOffset + startIndex;
        const absoluteEndExclusive = lineStartOffset + endIndexExclusive;

        if (legacyOffset >= absoluteStart && legacyOffset < absoluteEndExclusive) {
            bestMatch = { index: startIndex, state: match[1] };
            break;
        }

        // Fallback: first checkbox after the clicked offset within the same line
        if (!bestMatch && absoluteStart >= legacyOffset) {
            bestMatch = { index: startIndex, state: match[1] };
        }
    }

    if (!bestMatch) {
        return;
    }

    if (!options.enableExtendedStates && (bestMatch.state === '~' || bestMatch.state === '-')) {
        return;
    }

    const replaceStart = new vscode.Position(anchorPos.line, bestMatch.index + 1);
    const replaceEnd = new vscode.Position(anchorPos.line, bestMatch.index + 2);
    const next = computeNextState(bestMatch.state, options.enableExtendedStates);

    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(replaceStart, replaceEnd), next);
    await vscode.workspace.applyEdit(edit);
    try {
        await document.save();
    } catch {
        // ignore
    }
    await refreshMarkdownPreview(uri);
}

function computeNextState(current: string, enableExtendedStates: boolean): string {
    let configuredCycle = readPersistCycle();
    if (!enableExtendedStates) {
        configuredCycle = configuredCycle.filter(s => s === 'unchecked' || s === 'checked');
    }
    if (configuredCycle.length >= 2) {
        const currentName = stateCharToName(current);
        const idx = configuredCycle.indexOf(currentName);
        const nextName = configuredCycle[(idx === -1 ? 0 : (idx + 1) % configuredCycle.length)];
        return stateNameToChar(nextName);
    }

    // Default (kept intentionally simple):
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
        return enableExtendedStates ? 'x' : 'x';
    }
    if (c === '-') {
        return enableExtendedStates ? ' ' : ' ';
    }
    return 'x';
}

export function activate(context: vscode.ExtensionContext) {
	const output = getOutput();
	output.appendLine('Activated.');
	context.subscriptions.push(output);

    const toggleCommand = vscode.commands.registerCommand('mjsk-markdown-checkboxes.toggle', async (args: any) => {
        await applyToggleFromArgs(args ?? {});
    });

    context.subscriptions.push(toggleCommand);

    context.subscriptions.push(vscode.window.registerUriHandler({
        async handleUri(uri: vscode.Uri) {
            // Expect: vscode://<extensionId>/toggle?args=<encodedJson>
			output.appendLine(`[uri] ${uri.toString(true)}`);
			if (uri.authority !== EXTENSION_ID) {
				output.appendLine(`[uri] ignored authority=${uri.authority}`);
				return;
			}
			if (uri.path !== '/toggle') {
				output.appendLine(`[uri] ignored path=${uri.path}`);
				return;
			}
            const args = parseToggleArgsFromUri(uri);
            await applyToggleFromArgs(args);
        }
    }));

    return {
        extendMarkdownIt(md: MarkdownIt) {
            const options = getOptions();

            // Only use markdown-it-task-lists when:
            // 1. Persistence is OFF (so we don't need click handling)
            // 2. Extended states are OFF (so we don't need [~] / [-] support)
            // Otherwise, our custom plugin handles everything.
            if (!options.persistPreviewChanges && !options.enableExtendedStates) {
                md.use(() => md.use(taskList, {
                    enabled: options.enabled,
                    label: options.label,
                    labelAfter: options.labelAfter,
                }));
            }

            md.use(checklistPlugin, getOptions);
            return md;
        }
    };
}
