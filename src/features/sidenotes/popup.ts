import { setCssProps } from './dom-utils';

export function setupSidenotePopup(anchor: HTMLElement): () => void {
	const document = anchor.ownerDocument;
	const margin = anchor.querySelector<HTMLElement>(
		':scope > .editing-suite-sidenote-margin',
	);
	if (margin) {
		margin.setAttribute('role', 'note');
		margin.setAttribute(
			'aria-label',
			`边注 ${anchor.dataset.sidenoteNumber ?? ''}`.trim(),
		);
		margin.tabIndex = -1;
	}
	const onPointerDown = (event: PointerEvent): void => {
		const target = event.target as Node | null;
		const reference = (target as Element | null)?.closest?.<HTMLElement>(
			'.editing-suite-sidenote-reference',
		) ?? null;
		if (
			anchor.classList.contains('is-popup-open') &&
			target &&
			!anchor.contains(target) &&
			reference?.dataset.sidenoteInstance !==
				anchor.dataset.sidenoteInstance
		) {
			closeSidenotePopup(anchor);
		}
	};
	const onKeyDown = (event: KeyboardEvent): void => {
		if (
			event.key === 'Escape' &&
			anchor.classList.contains('is-popup-open')
		) {
			event.preventDefault();
			event.stopPropagation();
			closeSidenotePopup(anchor, true);
		}
	};

	document.addEventListener('pointerdown', onPointerDown, true);
	document.addEventListener('keydown', onKeyDown, true);
	return () => {
		closeSidenotePopup(anchor);
		document.removeEventListener('pointerdown', onPointerDown, true);
		document.removeEventListener('keydown', onKeyDown, true);
	};
}

function positionPopup(anchor: HTMLElement): void {
	const margin = anchor.querySelector<HTMLElement>(
		':scope > .editing-suite-sidenote-margin',
	);
	if (!margin) {
		return;
	}
	const referenceRect = getReferenceLinks(anchor)[0]
		?.getBoundingClientRect();
	const baseAnchorRect = anchor.getBoundingClientRect();
	const anchorRect = referenceRect ?? baseAnchorRect;
	const marginRect = margin.getBoundingClientRect();
	const marginWidth = marginRect.width;
	const viewportWidth = anchor.ownerDocument.documentElement.clientWidth;
	const viewportHeight = anchor.ownerDocument.documentElement.clientHeight;
	const edge = 12;
	const gap = 10;
	const targetCenter = anchorRect.left + anchorRect.width / 2;
	const absoluteLeft = Math.max(
		edge,
		Math.min(
			targetCenter - marginWidth / 2,
			viewportWidth - edge - marginWidth,
		),
	);
	const availableBelow = viewportHeight - anchorRect.bottom - gap - edge;
	const availableAbove = anchorRect.top - gap - edge;
	const openAbove = availableBelow < 180 && availableAbove > availableBelow;
	const popupHeight = margin.getBoundingClientRect().height;
	const top = openAbove
		? anchorRect.top - baseAnchorRect.top - popupHeight - gap
		: anchorRect.bottom - baseAnchorRect.top + gap;
	const left = absoluteLeft - baseAnchorRect.left;
	const arrowLeft = Math.max(
		14,
		Math.min(targetCenter - absoluteLeft, marginWidth - 14),
	);
	anchor.classList.toggle('is-popup-above', openAbove);
	setCssProps(margin, {
		'--editing-suite-sidenote-popup-arrow-left': `${Math.round(arrowLeft)}px`,
		'--editing-suite-sidenote-popup-left': `${Math.round(left)}px`,
		'--editing-suite-sidenote-popup-top': `${Math.round(top)}px`,
	});
}

export function setSidenotePopupMode(
	anchor: HTMLElement,
	popupOnly: boolean,
	preserveOpen = false,
): void {
	const wasOpen =
		preserveOpen && anchor.classList.contains('is-popup-open');
	anchor.classList.toggle('is-popup-only', popupOnly);
	if (!popupOnly && !wasOpen) {
		anchor.classList.remove('is-popup-open', 'is-popup-above');
	}
	if (popupOnly && wasOpen) {
		anchor.classList.add('is-popup-open');
		positionPopup(anchor);
	}
	syncReferenceState(
		anchor,
		popupOnly,
		popupOnly && (wasOpen || anchor.classList.contains('is-popup-open')),
	);
}

export function toggleSidenotePopup(
	anchor: HTMLElement,
	focusPopup = false,
): void {
	if (!anchor.classList.contains('is-popup-only')) {
		return;
	}
	if (anchor.classList.contains('is-popup-open')) {
		closeSidenotePopup(anchor);
		return;
	}
	closeOtherPopups(anchor);
	anchor.classList.add('is-popup-open');
	syncReferenceState(anchor, true, true);
	positionPopup(anchor);
	if (focusPopup) {
		anchor.querySelector<HTMLElement>(
			':scope > .editing-suite-sidenote-margin',
		)?.focus({ preventScroll: true });
	}
}

function closeOtherPopups(anchor: HTMLElement): void {
	const openedAnchors = Array.from(
		anchor.ownerDocument.querySelectorAll<HTMLElement>(
			'.editing-suite-sidenote-anchor.is-popup-open',
		),
	);
	for (const opened of openedAnchors) {
		if (opened === anchor) {
			continue;
		}
		closeSidenotePopup(opened);
	}
}

function closeSidenotePopup(
	anchor: HTMLElement,
	restoreFocus = false,
): void {
	if (!anchor.classList.contains('is-popup-open')) {
		return;
	}
	anchor.classList.remove('is-popup-open', 'is-popup-above');
	syncReferenceState(
		anchor,
		anchor.classList.contains('is-popup-only'),
		false,
	);
	if (restoreFocus) {
		getReferenceLinks(anchor)[0]?.focus({ preventScroll: true });
	}
}

function getReferenceLinks(anchor: HTMLElement): HTMLElement[] {
	const instanceId = anchor.dataset.sidenoteInstance;
	if (!instanceId) {
		return [];
	}
	return Array.from(anchor.ownerDocument.querySelectorAll<HTMLElement>(
		`.editing-suite-sidenote-reference[data-sidenote-instance="${instanceId}"] ` +
			'.editing-suite-sidenote-reference-link',
	));
}

function syncReferenceState(
	anchor: HTMLElement,
	popupOnly: boolean,
	expanded: boolean,
): void {
	for (const link of getReferenceLinks(anchor)) {
		const sourceReference = Boolean(link.closest('.markdown-source-view'));
		link.classList.toggle('is-popup-trigger', popupOnly);
		link.setAttribute('aria-expanded', String(expanded));
		if (popupOnly) {
			link.setAttribute('aria-haspopup', 'dialog');
			link.setAttribute(
				'aria-label',
				`打开边注 ${anchor.dataset.sidenoteNumber ?? ''}`.trim(),
			);
			link.setAttribute('role', 'button');
			link.tabIndex = 0;
		} else {
			link.removeAttribute('aria-haspopup');
			link.setAttribute(
				'aria-label',
				sourceReference
					? `编辑边注 ${anchor.dataset.sidenoteNumber ?? ''}`.trim()
					: `边注 ${anchor.dataset.sidenoteNumber ?? ''}`.trim(),
			);
			if (sourceReference) {
				link.setAttribute('role', 'button');
				link.tabIndex = 0;
			} else {
				link.removeAttribute('role');
				link.tabIndex = -1;
			}
		}
	}
}
