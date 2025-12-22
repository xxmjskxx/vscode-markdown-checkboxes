import * as vscode from 'vscode';
import * as taskList from 'markdown-it-task-lists';
import type MarkdownIt from 'markdown-it';

import { checklistPlugin, type CheckboxPluginOptions } from './plugin';

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
    const toggleCommand = vscode.commands.registerCommand('mjsk-markdown-checkboxes.toggle', async (args: any) => {
        const options = getOptions();
        if (!options.persistPreviewChanges) {
            return;
        }

        const uri = await resolveTargetDocumentUri(args?.uri);
        const offset = typeof args?.offset === 'number' ? args.offset : undefined;
        if (!uri || typeof offset !== 'number' || offset < 0) {
            return;
        }

        const document = await vscode.workspace.openTextDocument(uri);

        // Prefer offset-based updates (supports tables with multiple checkboxes per line).
        const anchorPos = document.positionAt(offset);
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

            if (offset >= absoluteStart && offset < absoluteEndExclusive) {
                bestMatch = { index: startIndex, state: match[1] };
                break;
            }

            // Fallback: first checkbox after the clicked offset within the same line
            if (!bestMatch && absoluteStart >= offset) {
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
    });

    context.subscriptions.push(toggleCommand);

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
