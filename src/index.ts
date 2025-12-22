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

async function applyToggleFromArgs(args: ToggleArgs): Promise<void> {
    const options = getOptions();
    if (!options.persistPreviewChanges) {
        return;
    }

    const uri = await resolveTargetDocumentUri(args?.uri);
    const legacyOffset = typeof args?.offset === 'number' ? (args.offset as number) : undefined;
    const lineNumber = typeof args?.line === 'number' ? (args.line as number) : undefined;
    const inlinePos = typeof args?.inlinePos === 'number' ? (args.inlinePos as number) : undefined;
    const occurrenceIndex = typeof args?.index === 'number' ? (args.index as number) : undefined;

    if (!uri) {
        return;
    }

    const document = await vscode.workspace.openTextDocument(uri);

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
	const output = vscode.window.createOutputChannel('Mjsk Markdown Checkboxes');
	output.appendLine('Activated.');
	context.subscriptions.push(output);

    const toggleCommand = vscode.commands.registerCommand('mjsk-markdown-checkboxes.toggle', async (args: any) => {
        await applyToggleFromArgs(args ?? {});
    });

    context.subscriptions.push(toggleCommand);

    context.subscriptions.push(vscode.window.registerUriHandler({
        async handleUri(uri: vscode.Uri) {
            // Expect: vscode://<extensionId>/toggle?args=<encodedJson>
            if (uri.authority !== EXTENSION_ID) {
                return;
            }
            if (uri.path !== '/toggle') {
                return;
            }
            const args = parseToggleArgsFromUri(uri);
            await applyToggleFromArgs(args);
        }
    }));

    return {
        extendMarkdownIt(md: MarkdownIt) {
            const options = getOptions();

            // Default behavior stays on markdown-it-task-lists.
            if (!options.persistPreviewChanges) {
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
