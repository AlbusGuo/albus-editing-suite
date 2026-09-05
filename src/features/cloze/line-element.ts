const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export function createClozeLine(document: Document): SVGSVGElement {
	const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
	svg.classList.add('editing-suite-cloze-line');
	svg.setAttribute('viewBox', '0 0 100 1');
	svg.setAttribute('preserveAspectRatio', 'none');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('focusable', 'false');

	const line = document.createElementNS(SVG_NAMESPACE, 'line');
	line.setAttribute('x1', '0');
	line.setAttribute('x2', '100');
	line.setAttribute('y1', '0.5');
	line.setAttribute('y2', '0.5');
	svg.appendChild(line);

	return svg;
}
