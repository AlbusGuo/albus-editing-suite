export interface SidenoteCollisionItem {
	anchorTop: number;
	height: number;
}

export function resolveSidenotePositions(
	items: readonly SidenoteCollisionItem[],
	topBound: number,
	gap: number,
): number[] {
	const positions: number[] = [];
	let nextTop = topBound;
	for (const item of items) {
		const top = Math.max(item.anchorTop, nextTop);
		positions.push(top);
		nextTop = top + item.height + gap;
	}
	return positions;
}
