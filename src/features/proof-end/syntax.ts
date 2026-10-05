export const PROOF_END_SYMBOL = '█';

export function findProofEndOffsets(text: string): number[] {
	const offsets: number[] = [];
	for (
		let index = text.indexOf(PROOF_END_SYMBOL);
		index >= 0;
		index = text.indexOf(PROOF_END_SYMBOL, index + 1)
	) {
		if (
			text.charAt(index - 1) !== PROOF_END_SYMBOL &&
			text.charAt(index + 1) !== PROOF_END_SYMBOL
		) {
			offsets.push(index);
		}
	}
	return offsets;
}
