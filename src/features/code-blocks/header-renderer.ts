import { setIcon } from 'obsidian';
import type { CodeLanguageInfo } from './language-registry';

export function createCodeHeader(
	document: Document,
	language: CodeLanguageInfo,
	tagName: 'div' | 'span' = 'div',
): HTMLElement {
	const element = document.createElement(tagName);
	element.className = 'editing-suite-code-header-content';
	if (!language.raw) {
		const dots = document.createElement('span');
		dots.className = 'editing-suite-code-window-dots';
		for (let index = 0; index < 3; index++) {
			dots.appendChild(document.createElement('i'));
		}
		dots.setAttribute('aria-hidden', 'true');
		element.appendChild(dots);
	} else {
		const icon = document.createElement('span');
		if (language.brandIconKey) {
			icon.className =
				`editing-suite-code-language-icon editing-suite-code-language-brand-icon language-${language.brandIconKey}`;
		} else {
			icon.className =
				`editing-suite-code-language-icon editing-suite-code-language-${language.group}`;
			setIcon(icon, language.icon ?? 'code-2');
		}
		icon.setAttribute('aria-hidden', 'true');
		element.appendChild(icon);
	}

	if (language.label) {
		const label = document.createElement('span');
		label.className = 'editing-suite-code-language-label';
		label.textContent = language.label;
		element.appendChild(label);
	}
	return element;
}
