export function observeSidenoteImages(
	root: ParentNode,
	onSettled: () => void,
): () => void {
	const pending = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
		.filter((image) => !image.complete);
	if (pending.length === 0) {
		return () => undefined;
	}
	const listeners = new Map<HTMLImageElement, () => void>();
	for (const image of pending) {
		const listener = (): void => {
			image.removeEventListener('load', listener);
			image.removeEventListener('error', listener);
			listeners.delete(image);
			onSettled();
		};
		listeners.set(image, listener);
		image.addEventListener('load', listener, { once: true });
		image.addEventListener('error', listener, { once: true });
	}
	return () => {
		for (const [image, listener] of listeners) {
			image.removeEventListener('load', listener);
			image.removeEventListener('error', listener);
		}
		listeners.clear();
	};
}
