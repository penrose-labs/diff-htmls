import { BlockDiffOptions } from "./types"
import * as Utils from "./Utils"

/**
 * Represents a block-level element in the tokenized word list
 */
export type Block = {
	tagName: string
	startIndex: number
	endIndex: number
	// For nested blocks, this helps track depth
	depth: number
}

/**
 * Analyzes tokenized words to identify block-level element boundaries
 */
class BlockAnalyzer {
	private blockElements: Set<string>
	private equivalentTypes: Map<string, Set<string>>

	constructor(options?: BlockDiffOptions) {
		// Use custom block elements or default
		if (options?.blockElements) {
			this.blockElements = new Set(options.blockElements.map((e) => e.toLowerCase()))
		} else {
			this.blockElements = Utils.blockLevelElements
		}

		// Build equivalence map for type grouping
		this.equivalentTypes = new Map()
		if (options?.equivalentTypes) {
			for (const group of options.equivalentTypes) {
				const groupSet = new Set(group.map((e) => e.toLowerCase()))
				for (const element of group) {
					this.equivalentTypes.set(element.toLowerCase(), groupSet)
				}
			}
		}
	}

	/**
	 * Find all top-level block elements in a list of words
	 * Returns blocks with their start and end indices in the word array
	 */
	findBlocks(words: string[]): Block[] {
		const blocks: Block[] = []
		const stack: { tagName: string; startIndex: number; depth: number }[] = []
		let currentDepth = 0

		for (let i = 0; i < words.length; i++) {
			const word = words[i]

			if (!Utils.isTag(word)) {
				continue
			}

			const tagName = Utils.getTagName(word)
			if (!tagName || !this.blockElements.has(tagName)) {
				continue
			}

			if (Utils.isOpeningTag(word)) {
				stack.push({ tagName, startIndex: i, depth: currentDepth })
				currentDepth++
			} else if (Utils.isClosingTag(word) && stack.length > 0) {
				// Find the matching opening tag
				for (let j = stack.length - 1; j >= 0; j--) {
					if (stack[j].tagName === tagName) {
						const openingTag = stack.splice(j, 1)[0]
						currentDepth--

						// Only track top-level blocks (depth 0)
						if (openingTag.depth === 0) {
							blocks.push({
								tagName: openingTag.tagName,
								startIndex: openingTag.startIndex,
								endIndex: i,
								depth: openingTag.depth
							})
						}
						break
					}
				}
			}
		}

		// Sort by start index
		blocks.sort((a, b) => a.startIndex - b.startIndex)
		return blocks
	}

	/**
	 * Find matching block pairs between old and new word arrays
	 * Returns pairs of blocks that occupy the same position
	 */
	matchBlocksByPosition(
		oldBlocks: Block[],
		newBlocks: Block[]
	): { oldBlock: Block | null; newBlock: Block | null }[] {
		const pairs: { oldBlock: Block | null; newBlock: Block | null }[] = []
		let oldIdx = 0
		let newIdx = 0

		while (oldIdx < oldBlocks.length || newIdx < newBlocks.length) {
			const oldBlock = oldBlocks[oldIdx] || null
			const newBlock = newBlocks[newIdx] || null

			if (!oldBlock) {
				pairs.push({ oldBlock: null, newBlock })
				newIdx++
			} else if (!newBlock) {
				pairs.push({ oldBlock, newBlock: null })
				oldIdx++
			} else {
				// Both exist - pair them by sequence
				pairs.push({ oldBlock, newBlock })
				oldIdx++
				newIdx++
			}
		}

		return pairs
	}

	/**
	 * Check if two blocks have the same element type (or equivalent types based on config)
	 */
	isSameBlockType(block1: Block | null, block2: Block | null): boolean {
		if (!block1 || !block2) {
			return false
		}

		const tag1 = block1.tagName
		const tag2 = block2.tagName

		// Exact match
		if (tag1 === tag2) {
			return true
		}

		// Check if they're in the same equivalence group
		const equivalentGroup = this.equivalentTypes.get(tag1)
		if (equivalentGroup && equivalentGroup.has(tag2)) {
			return true
		}

		return false
	}

	/**
	 * Get the raw HTML content of a block from the words array
	 */
	getBlockContent(words: string[], block: Block): string {
		return words.slice(block.startIndex, block.endIndex + 1).join("")
	}

	/**
	 * Get the words within a block (excluding the opening and closing tags)
	 */
	getBlockInnerWords(words: string[], block: Block): string[] {
		return words.slice(block.startIndex + 1, block.endIndex)
	}
}

export default BlockAnalyzer
