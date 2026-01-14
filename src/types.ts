export enum Mode {
	character,
	tag,
	whitespace,
	number,
	entity
}

export enum Action {
	equal,
	delete,
	insert,
	none,
	replace
}

export type MatchOptions = {
	blockSize: number
	repeatingWordsAccuracy: number
	ignoreWhitespaceDifferences: boolean
}

export type BlockExpression = {
	exp: RegExp
	compareBy?: RegExp
}

/**
 * Configuration for block-aware diffing behavior
 */
export type BlockDiffOptions = {
	/**
	 * When enabled, if a block-level element type changes (e.g., <ul> to <p>),
	 * the entire block is shown as deleted/inserted rather than word-by-word diff.
	 * When the element type stays the same, word-by-word diffing is used.
	 * @default false
	 */
	enabled: boolean

	/**
	 * Custom list of block-level element tag names to consider.
	 * If not provided, uses the default list (p, div, ul, ol, li, h1-h6, etc.)
	 */
	blockElements?: string[]

	/**
	 * Groups of element types that should be treated as "same type" for diffing purposes.
	 * Elements within the same group will use inline word diff even if tags differ.
	 * Example: [["ul", "ol"]] would treat ul->ol changes as inline diffs.
	 * @default [] (no grouping - exact tag match required)
	 */
	equivalentTypes?: string[][]
}
