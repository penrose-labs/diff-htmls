import BlockAnalyzer, { Block } from "./BlockAnalyzer"
import Match from "./Match"
import MatchFinder from "./MatchFinder"
import MatchOptions from "./MatchOptions"
import Operation from "./Operation"
import { Action, BlockDiffOptions, BlockExpression } from "./types"
import * as Utils from "./Utils"
import WordSplitter from "./WordSplitter"

// This value defines balance between speed and memory utilization. The higher it is the faster it works and more memory consumes.
const MatchGranularityMaximum = 4

const specialCaseClosingTags = new Map([
	["</strong>", 0],
	["</em>", 0],
	["</b>", 0],
	["</i>", 0],
	["</big>", 0],
	["</small>", 0],
	["</u>", 0],
	["</sub>", 0],
	["</strike>", 0],
	["</s>", 0],
	["</dfn>", 0]
])

const specialCaseOpeningTagRegex =
	/<((strong)|(b)|(i)|(dfn)|(em)|(big)|(small)|(u)|(sub)|(sup)|(strike)|(s))[\>\s]+/gi

type FindMathProps = {
	startInOld: number
	endInOld: number
	startInNew: number
	endInNew: number
}

type HtmlDiffOptions = {
	blockDiff?: BlockDiffOptions
}

class HtmlDiff {
	private content: string[]
	private newText: string
	private oldText: string

	private specialTagDiffStack: string[]
	private newWords: string[]
	private oldWords: string[]
	private originalWordsInNew: Map<number, string>
	private originalWordsInOld: Map<number, string>

	private matchGranularity: number
	private blockExpressions: BlockExpression[]

	private repeatingWordsAccuracy: number
	private ignoreWhiteSpaceDifferences: boolean
	private orphanMatchThreshold: number

	// Block-aware diffing
	private blockDiffOptions?: BlockDiffOptions
	private blockAnalyzer?: BlockAnalyzer
	private oldBlocks: Block[] = []
	private newBlocks: Block[] = []

	constructor(oldText: string, newText: string, options?: HtmlDiffOptions) {
		this.content = []
		this.newText = newText
		this.oldText = oldText

		this.specialTagDiffStack = []
		this.newWords = []
		this.originalWordsInNew = new Map()
		this.oldWords = []
		this.originalWordsInOld = new Map()
		this.matchGranularity = 0
		this.blockExpressions = []

		this.repeatingWordsAccuracy = 1.0
		this.ignoreWhiteSpaceDifferences = false
		this.orphanMatchThreshold = 0.0

		// Initialize block-aware diffing if enabled
		this.blockDiffOptions = options?.blockDiff
		if (this.blockDiffOptions?.enabled) {
			this.blockAnalyzer = new BlockAnalyzer(this.blockDiffOptions)
		}

		this.addBlockExpression = this.addBlockExpression.bind(this)
	}

	diff() {
		if (this.oldText === this.newText) {
			return this.newText
		}

		this.splitInputsIntoWords()

		// If block-aware diffing is enabled, analyze blocks and handle block type changes
		if (this.blockAnalyzer) {
			this.oldBlocks = this.blockAnalyzer.findBlocks(this.oldWords)
			this.newBlocks = this.blockAnalyzer.findBlocks(this.newWords)

			// Check if we have block type mismatches that should be handled as full replacements
			const blockTypeChanges = this.detectBlockTypeChanges()
			if (blockTypeChanges.length > 0) {
				return this.diffWithBlockTypeChanges(blockTypeChanges)
			}
		}

		this.matchGranularity = Math.min(
			MatchGranularityMaximum,
			this.oldWords.length,
			this.newWords.length
		)
		let operations = this.operations()

		// set original words
		this.originalWordsInOld.forEach((value, key) => {
			this.oldWords[key] = value
		})

		this.originalWordsInNew.forEach((value, key) => {
			this.newWords[key] = value
		})

		for (let item of operations) {
			this.performOperation(item)
		}

		return this.content.join("")
	}

	/**
	 * Detect ranges of blocks in old and new that have different types.
	 * Returns array of word index ranges that need block-level replacement.
	 */
	private detectBlockTypeChanges(): {
		oldStart: number
		oldEnd: number
		newStart: number
		newEnd: number
	}[] {
		if (!this.blockAnalyzer) return []

		const changes: {
			oldStart: number
			oldEnd: number
			newStart: number
			newEnd: number
		}[] = []

		const matches = this.matchBlocksByTypeSimilarity()
		const anchoredMatches = [
			{ oldIndex: -1, newIndex: -1 },
			...matches,
			{ oldIndex: this.oldBlocks.length, newIndex: this.newBlocks.length }
		]

		for (let i = 0; i < anchoredMatches.length - 1; i++) {
			const current = anchoredMatches[i]
			const next = anchoredMatches[i + 1]
			const oldRange = this.oldBlocks.slice(current.oldIndex + 1, next.oldIndex)
			const newRange = this.newBlocks.slice(current.newIndex + 1, next.newIndex)

			if (oldRange.length === 0 || newRange.length === 0) {
				continue
			}

			let typesMatch = oldRange.length === newRange.length
			if (typesMatch) {
				for (let j = 0; j < oldRange.length; j++) {
					if (!this.blockAnalyzer.isSameBlockType(oldRange[j], newRange[j])) {
						typesMatch = false
						break
					}
				}
			}

			if (!typesMatch) {
				changes.push({
					oldStart: oldRange[0].startIndex,
					oldEnd: oldRange[oldRange.length - 1].endIndex,
					newStart: newRange[0].startIndex,
					newEnd: newRange[newRange.length - 1].endIndex
				})
			}
		}

		return changes
	}

	/**
	 * Match blocks that appear to be the same logical unit.
	 * Uses a weighted LCS based on block type and content length similarity.
	 */
	private matchBlocksByTypeSimilarity(): { oldIndex: number; newIndex: number }[] {
		if (!this.blockAnalyzer) return []

		const oldCount = this.oldBlocks.length
		const newCount = this.newBlocks.length
		const blockAnalyzer = this.blockAnalyzer
		const oldLengths = this.oldBlocks.map(
			(block) => blockAnalyzer.getBlockInnerWords(this.oldWords, block).join("").length
		)
		const newLengths = this.newBlocks.map(
			(block) => blockAnalyzer.getBlockInnerWords(this.newWords, block).join("").length
		)

		const scoreForMatch = (oldIndex: number, newIndex: number) => {
			const oldBlock = this.oldBlocks[oldIndex]
			const newBlock = this.newBlocks[newIndex]
			if (!oldBlock || !newBlock || !this.blockAnalyzer) {
				return 0
			}
			if (!this.blockAnalyzer.isSameBlockType(oldBlock, newBlock)) {
				return 0
			}

			const oldLength = oldLengths[oldIndex]
			const newLength = newLengths[newIndex]
			const maxLength = Math.max(oldLength, newLength)
			if (maxLength === 0) {
				return 100
			}

			const diffRatio = Math.abs(oldLength - newLength) / maxLength
			return 100 - Math.round(diffRatio * 100)
		}

		const dp: number[][] = Array.from({ length: oldCount + 1 }, () =>
			Array(newCount + 1).fill(0)
		)

		for (let i = oldCount - 1; i >= 0; i--) {
			for (let j = newCount - 1; j >= 0; j--) {
				const matchScore = scoreForMatch(i, j)
				const skipOld = dp[i + 1][j]
				const skipNew = dp[i][j + 1]
				const takeMatch = matchScore > 0 ? dp[i + 1][j + 1] + matchScore : 0

				dp[i][j] = Math.max(skipOld, skipNew, takeMatch)
			}
		}

		const matches: { oldIndex: number; newIndex: number }[] = []
		let i = 0
		let j = 0

		while (i < oldCount && j < newCount) {
			const matchScore = scoreForMatch(i, j)
			if (matchScore > 0 && dp[i][j] === dp[i + 1][j + 1] + matchScore) {
				matches.push({ oldIndex: i, newIndex: j })
				i++
				j++
				continue
			}

			if (dp[i + 1][j] >= dp[i][j + 1]) {
				i++
			} else {
				j++
			}
		}

		return matches
	}

	/**
	 * Handle diffing when there are block type changes.
	 * Blocks with type changes are shown as full del/ins pairs.
	 * Other content uses standard word-level diffing.
	 */
	private diffWithBlockTypeChanges(
		blockTypeChanges: {
			oldStart: number
			oldEnd: number
			newStart: number
			newEnd: number
		}[]
	): string {
		const result: string[] = []

		// Track which ranges we've processed
		let oldPos = 0
		let newPos = 0

		// Process content before, between, and after block type changes
		for (const change of blockTypeChanges) {
			// Process content before this block change
			if (oldPos < change.oldStart || newPos < change.newStart) {
				const beforeOldWords = this.oldWords.slice(oldPos, change.oldStart)
				const beforeNewWords = this.newWords.slice(newPos, change.newStart)

				if (beforeOldWords.length > 0 || beforeNewWords.length > 0) {
					const beforeDiff = this.diffWordRanges(beforeOldWords, beforeNewWords)
					result.push(beforeDiff)
				}
			}

			// Output the block type change as del/ins
			const oldBlockContent = this.oldWords
				.slice(change.oldStart, change.oldEnd + 1)
				.join("")
			const newBlockContent = this.newWords
				.slice(change.newStart, change.newEnd + 1)
				.join("")

			result.push(`<del class="diffdel">${oldBlockContent}</del>`)
			result.push(`<ins class="diffins">${newBlockContent}</ins>`)

			oldPos = change.oldEnd + 1
			newPos = change.newEnd + 1
		}

		// Process any remaining content after the last block change
		if (oldPos < this.oldWords.length || newPos < this.newWords.length) {
			const afterOldWords = this.oldWords.slice(oldPos)
			const afterNewWords = this.newWords.slice(newPos)

			if (afterOldWords.length > 0 || afterNewWords.length > 0) {
				const afterDiff = this.diffWordRanges(afterOldWords, afterNewWords)
				result.push(afterDiff)
			}
		}

		return result.join("")
	}

	/**
	 * Diff two word arrays and return the HTML result
	 */
	private diffWordRanges(oldWords: string[], newWords: string[]): string {
		if (oldWords.length === 0 && newWords.length === 0) {
			return ""
		}

		// Create a mini-diff for these word ranges
		const oldText = oldWords.join("")
		const newText = newWords.join("")

		if (oldText === newText) {
			return newText
		}

		// Use a new HtmlDiff instance without block-aware diffing for sub-ranges
		const subDiff = new HtmlDiff(oldText, newText)
		return subDiff.diff()
	}

	addBlockExpression(exp: BlockExpression) {
		this.blockExpressions.push(exp)
	}

	splitInputsIntoWords() {
		const words = WordSplitter.convertHtmlToListOfWords(
			this.oldText,
			this.blockExpressions
		)
		words.forEach((el, idx) => {
			el[1] && this.originalWordsInOld.set(idx, el[1])
		})
		this.oldWords = words.map((el) => el[0])

		//free memory, allow it for GC
		this.oldText = ""

		const newWords = WordSplitter.convertHtmlToListOfWords(
			this.newText,
			this.blockExpressions
		)

		newWords.forEach((el, idx) => el[1] && this.originalWordsInNew.set(idx, el[1]))
		this.newWords = newWords.map((el) => el[0])

		//free memory, allow it for GC
		this.newText = ""
	}

	performOperation(opp: Operation) {
		switch (opp.action) {
			case Action.equal:
				this.processEqualOperation(opp)
				break
			case Action.delete:
				this.processDeleteOperation(opp, "diffdel")
				break
			case Action.insert:
				this.processInsertOperation(opp, "diffins")
				break
			case Action.none:
				break
			case Action.replace:
				this.processReplaceOperation(opp)
				break
		}
	}

	processReplaceOperation(opp: Operation) {
		// Check if block-aware diffing applies to this operation
		if (this.blockAnalyzer && this.shouldUseBlockReplacement(opp)) {
			// Different block types - show as full block deletion/insertion
			this.processDeleteOperation(opp, "diffdel")
			this.processInsertOperation(opp, "diffins")
		} else {
			// Same block type or no blocks - use word-by-word diff
			this.processDeleteOperation(opp, "diffmod")
			this.processInsertOperation(opp, "diffmod")
		}
	}

	/**
	 * Determines if a replace operation should use block replacement
	 * (full del/ins) instead of word-by-word diffing (diffmod).
	 *
	 * Returns true if:
	 * - Block-aware diffing is enabled
	 * - The operation involves different block-level element types
	 */
	private shouldUseBlockReplacement(opp: Operation): boolean {
		if (!this.blockAnalyzer) {
			return false
		}

		// Find blocks that overlap with the operation range (any overlap counts)
		const oldBlocksInRange = this.oldBlocks.filter(
			(b) => b.startIndex < opp.endInOld && b.endIndex >= opp.startInOld
		)
		const newBlocksInRange = this.newBlocks.filter(
			(b) => b.startIndex < opp.endInNew && b.endIndex >= opp.startInNew
		)

		// If no blocks in either range, use regular word diff
		if (oldBlocksInRange.length === 0 && newBlocksInRange.length === 0) {
			return false
		}

		// If blocks exist in one but not the other, that's a structure change
		if (oldBlocksInRange.length === 0 || newBlocksInRange.length === 0) {
			return true
		}

		// If different number of blocks, use block replacement
		if (oldBlocksInRange.length !== newBlocksInRange.length) {
			return true
		}

		// Check if any paired blocks have different types
		for (let i = 0; i < oldBlocksInRange.length; i++) {
			if (!this.blockAnalyzer.isSameBlockType(oldBlocksInRange[i], newBlocksInRange[i])) {
				return true
			}
		}

		return false
	}

	processInsertOperation(opp: Operation, cssClass: string) {
		let text = this.newWords.filter(
			(s, pos) => pos >= opp.startInNew && pos < opp.endInNew
		)
		this.insertTag("ins", cssClass, text)
	}

	processDeleteOperation(opp: Operation, cssClass: string) {
		let text = this.oldWords.filter(
			(s, pos) => pos >= opp.startInOld && pos < opp.endInOld
		)
		this.insertTag("del", cssClass, text)
	}

	processEqualOperation(opp: Operation) {
		let result = this.newWords.filter(
			(s, pos) => pos >= opp.startInNew && pos < opp.endInNew
		)
		this.content.push(result.join(""))
	}

	insertTag(tag: string, cssClass: string, content: string[]) {
		let length, nonTags, position, rendering, tags
		rendering = ""
		position = 0
		length = content.length
		while (true) {
			if (position >= length) {
				break
			}
			nonTags = this.consecutiveWhere(position, content, (x: string) => !Utils.isTag(x))
			position += nonTags.length
			if (nonTags.length !== 0) {
				rendering += `<${tag} class="${cssClass}">${nonTags.join("")}</${tag}>`
			}
			if (position >= length) {
				break
			}
			tags = this.consecutiveWhere(position, content, Utils.isTag)
			position += tags.length
			rendering += tags.join("")
		}

		this.content.push(rendering)
	}

	consecutiveWhere(
		start: number,
		content: string[],
		predicate: (value: string) => boolean
	) {
		let answer, i, index, lastMatchingIndex, len, token
		content = content.slice(start, +content.length + 1 || 9e9)
		lastMatchingIndex = void 0
		for (index = i = 0, len = content.length; i < len; index = ++i) {
			token = content[index]
			answer = predicate(token)
			if (answer === true) {
				lastMatchingIndex = index
			}
			if (answer === false) {
				break
			}
		}
		if (lastMatchingIndex != null) {
			return content.slice(0, +lastMatchingIndex + 1 || 9e9)
		}
		return []
	}

	operations() {
		let positionInOld = 0
		let positionInNew = 0
		let operations: Operation[] = []

		let matches = this.matchingBlocks()
		matches.push(new Match(this.oldWords.length, this.newWords.length, 0))

		let matchesWithoutOrphans = this.removeOrphans(matches)

		for (let match of matchesWithoutOrphans) {
			let matchStartsAtCurrentPositionInOld = positionInOld === match.startInOld
			let matchStartsAtCurrentPositionInNew = positionInNew === match.startInNew

			let action

			if (!matchStartsAtCurrentPositionInOld && !matchStartsAtCurrentPositionInNew) {
				action = Action.replace
			} else if (
				matchStartsAtCurrentPositionInOld &&
				!matchStartsAtCurrentPositionInNew
			) {
				action = Action.insert
			} else if (!matchStartsAtCurrentPositionInOld) {
				action = Action.delete
			} else {
				action = Action.none
			}

			if (action !== Action.none) {
				operations.push(
					new Operation({
						action,
						startInOld: positionInOld,
						endInOld: match.startInOld,
						startInNew: positionInNew,
						endInNew: match.startInNew
					})
				)
			}

			if (match.size !== 0) {
				operations.push(
					new Operation({
						action: Action.equal,
						startInOld: match.startInOld,
						endInOld: match.endInOld,
						startInNew: match.startInNew,
						endInNew: match.endInNew
					})
				)
			}

			positionInOld = match.endInOld
			positionInNew = match.endInNew
		}

		return operations
	}

	*removeOrphans(matches: Match[]) {
		let prev = null! as Match
		let curr = null! as Match

		for (let next of matches) {
			if (curr === null) {
				prev = new Match(0, 0, 0)
				curr = next
				continue
			}

			if (
				(prev?.endInOld === curr.startInOld && prev.endInNew === curr.startInNew) ||
				(curr.endInOld === next.startInOld && curr.endInNew === next.startInNew)
			) {
				yield curr
				curr = next
				continue
			}

			let sumLength = (t: number, n: string) => t + n.length

			let oldDistanceInChars = this.oldWords
				.slice(prev?.endInOld, next.startInOld)
				.reduce(sumLength, 0)
			let newDistanceInChars = this.newWords
				.slice(prev?.endInNew, next.startInNew)
				.reduce(sumLength, 0)
			let currMatchLengthInChars = this.newWords
				.slice(curr.startInNew, curr.endInNew)
				.reduce(sumLength, 0)
			if (
				currMatchLengthInChars >
				Math.max(oldDistanceInChars, newDistanceInChars) * this.orphanMatchThreshold
			) {
				yield curr
			}

			prev = curr
			curr = next
		}

		yield curr
	}

	matchingBlocks() {
		let matchingBlocks = [] as Match[]
		this.findMatchingBlocks({
			startInOld: 0,
			endInOld: this.oldWords.length,
			startInNew: 0,
			endInNew: this.newWords.length,
			matchingBlocks
		})
		return matchingBlocks
	}

	findMatchingBlocks({
		startInOld,
		endInOld,
		startInNew,
		endInNew,
		matchingBlocks
	}: FindMathProps & { matchingBlocks: Match[] }) {
		let match = this.findMatch({
			startInOld,
			endInOld,
			startInNew,
			endInNew
		})

		if (match !== null) {
			if (startInOld < match.startInOld && startInNew < match.startInNew) {
				this.findMatchingBlocks({
					startInOld,
					endInOld: match.startInOld,
					startInNew,
					endInNew: match.startInNew,
					matchingBlocks
				})
			}

			matchingBlocks.push(match)

			if (match.endInOld < endInOld && match.endInNew < endInNew) {
				this.findMatchingBlocks({
					startInOld: match.endInOld,
					endInOld,
					startInNew: match.endInNew,
					endInNew,
					matchingBlocks
				})
			}
		}
	}

	findMatch({ startInOld, endInOld, startInNew, endInNew }: FindMathProps) {
		for (let i = this.matchGranularity; i > 0; i--) {
			let options = MatchOptions
			options.blockSize = i
			options.repeatingWordsAccuracy = this.repeatingWordsAccuracy
			options.ignoreWhitespaceDifferences = this.ignoreWhiteSpaceDifferences

			let finder = new MatchFinder({
				oldWords: this.oldWords,
				newWords: this.newWords,
				startInOld,
				endInOld,
				startInNew,
				endInNew,
				options
			})
			let match = finder.findMatch()
			if (match !== null) {
				return match
			}
		}

		return null
	}
}

export default HtmlDiff
