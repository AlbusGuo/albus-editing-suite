const COMMAND_SURFACE_SELECTOR = [
	'button',
	'[role="button"]',
	'[role="menuitem"]',
	'[data-command-id]',
	'.clickable-icon',
	'.menu',
	'.menu-item',
	'.modal',
	'.popover',
	'.prompt',
	'.suggestion-container',
	'.command-palette',
	'.search-suggest-container',
	'.view-action',
].join(', ');

export function isCommandSurface(target: Element): boolean {
	return target.closest(COMMAND_SURFACE_SELECTOR) !== null;
}

export function setCssProps(
	element: HTMLElement,
	properties: Record<string, string>,
): void {
	for (const [property, value] of Object.entries(properties)) {
		element.style.setProperty(property, value);
	}
}
