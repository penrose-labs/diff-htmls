import HtmlDiff from "./Diff"
import { BlockDiffOptions, BlockExpression } from "./types"

export type Options = {
	/**
	 * Block expressions for treating certain patterns as atomic units
	 */
	blocksExpression?: BlockExpression[]

	/**
	 * Configuration for block-aware diffing.
	 * When enabled, changes between different block-level element types
	 * (e.g., <ul> to <p>) will show the entire block as deleted/inserted
	 * rather than word-by-word diffs.
	 */
	blockDiff?: BlockDiffOptions
}

const diff = (oldText: string, newText: string, options: Options = {}) => {
	const { blocksExpression, blockDiff } = options
	const finder = new HtmlDiff(oldText, newText, { blockDiff })
	if (blocksExpression) {
		blocksExpression.forEach((block) => finder.addBlockExpression(block))
	}
	return finder.diff()
}

export default diff

// Re-export types for consumers
export { BlockDiffOptions, BlockExpression }
