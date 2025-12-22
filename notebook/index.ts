import type MarkdownIt from 'markdown-it';
import type { RendererContext } from 'vscode-notebook-renderer';
import checkboxCss from '../checkboxes.css'

import { checklistPlugin } from '../src/plugin';
  
export async function activate(ctx: RendererContext<void>) {
	const markdownItRenderer = (await ctx.getRenderer('vscode.markdown-it-renderer')) as undefined | any;
	if (!markdownItRenderer) {
		throw new Error(`Could not load 'vscode.markdown-it-renderer'`);
	}

	const style = document.createElement('style');
	style.textContent = checkboxCss;
	const template = document.createElement('template');
	template.classList.add('markdown-style');
	template.content.appendChild(style);
	document.head.appendChild(template);

	markdownItRenderer.extendMarkdownIt((md: MarkdownIt) => {
		md.use(checklistPlugin, () => ({
			enabled: true,
			label: false,
			labelAfter: false,
			enableTableCheckboxes: false,
			enableExtendedStates: true,
			persistPreviewChanges: false,
		}));
		return md;
	});
}
