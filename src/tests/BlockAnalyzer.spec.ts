import BlockAnalyzer from "../BlockAnalyzer"
import WordSplitter from "../WordSplitter"

describe("BlockAnalyzer", () => {
	describe("findBlocks()", () => {
		it("finds a single paragraph block", () => {
			const html = "<p>Hello world</p>"
			const words = WordSplitter.convertHtmlToListOfWords(html).map((w) => w[0])
			const analyzer = new BlockAnalyzer({ enabled: true })
			const blocks = analyzer.findBlocks(words)

			expect(blocks).toHaveLength(1)
			expect(blocks[0].tagName).toBe("p")
			expect(blocks[0].startIndex).toBe(0)
		})

		it("finds multiple block elements", () => {
			const html = "<p>First</p><p>Second</p>"
			const words = WordSplitter.convertHtmlToListOfWords(html).map((w) => w[0])
			const analyzer = new BlockAnalyzer({ enabled: true })
			const blocks = analyzer.findBlocks(words)

			expect(blocks).toHaveLength(2)
			expect(blocks[0].tagName).toBe("p")
			expect(blocks[1].tagName).toBe("p")
		})

		it("finds list elements", () => {
			const html = "<ul><li>Item 1</li><li>Item 2</li></ul>"
			const words = WordSplitter.convertHtmlToListOfWords(html).map((w) => w[0])
			const analyzer = new BlockAnalyzer({ enabled: true })
			const blocks = analyzer.findBlocks(words)

			// Only top-level blocks are returned
			expect(blocks).toHaveLength(1)
			expect(blocks[0].tagName).toBe("ul")
		})

		it("uses custom block elements when provided", () => {
			const html = "<custom>Content</custom><p>Para</p>"
			const words = WordSplitter.convertHtmlToListOfWords(html).map((w) => w[0])

			// With default settings, custom is not a block element
			const defaultAnalyzer = new BlockAnalyzer({ enabled: true })
			const defaultBlocks = defaultAnalyzer.findBlocks(words)
			expect(defaultBlocks).toHaveLength(1) // Only <p>

			// With custom settings
			const customAnalyzer = new BlockAnalyzer({
				enabled: true,
				blockElements: ["custom", "p"]
			})
			const customBlocks = customAnalyzer.findBlocks(words)
			expect(customBlocks).toHaveLength(2)
		})
	})

	describe("isSameBlockType()", () => {
		it("returns true for same tag names", () => {
			const analyzer = new BlockAnalyzer({ enabled: true })
			const block1 = { tagName: "p", startIndex: 0, endIndex: 5, depth: 0 }
			const block2 = { tagName: "p", startIndex: 0, endIndex: 5, depth: 0 }

			expect(analyzer.isSameBlockType(block1, block2)).toBe(true)
		})

		it("returns false for different tag names by default", () => {
			const analyzer = new BlockAnalyzer({ enabled: true })
			const block1 = { tagName: "ul", startIndex: 0, endIndex: 5, depth: 0 }
			const block2 = { tagName: "p", startIndex: 0, endIndex: 5, depth: 0 }

			expect(analyzer.isSameBlockType(block1, block2)).toBe(false)
		})

		it("returns false for ul vs ol by default", () => {
			const analyzer = new BlockAnalyzer({ enabled: true })
			const block1 = { tagName: "ul", startIndex: 0, endIndex: 5, depth: 0 }
			const block2 = { tagName: "ol", startIndex: 0, endIndex: 5, depth: 0 }

			expect(analyzer.isSameBlockType(block1, block2)).toBe(false)
		})

		it("returns true for equivalent types when configured", () => {
			const analyzer = new BlockAnalyzer({
				enabled: true,
				equivalentTypes: [["ul", "ol"]]
			})
			const block1 = { tagName: "ul", startIndex: 0, endIndex: 5, depth: 0 }
			const block2 = { tagName: "ol", startIndex: 0, endIndex: 5, depth: 0 }

			expect(analyzer.isSameBlockType(block1, block2)).toBe(true)
		})

		it("handles null blocks", () => {
			const analyzer = new BlockAnalyzer({ enabled: true })
			const block = { tagName: "p", startIndex: 0, endIndex: 5, depth: 0 }

			expect(analyzer.isSameBlockType(null, block)).toBe(false)
			expect(analyzer.isSameBlockType(block, null)).toBe(false)
			expect(analyzer.isSameBlockType(null, null)).toBe(false)
		})
	})

	describe("getBlockContent()", () => {
		it("returns the full HTML content of a block", () => {
			const html = "<p>Hello world</p>"
			const words = WordSplitter.convertHtmlToListOfWords(html).map((w) => w[0])
			const analyzer = new BlockAnalyzer({ enabled: true })
			const blocks = analyzer.findBlocks(words)

			expect(analyzer.getBlockContent(words, blocks[0])).toBe("<p>Hello world</p>")
		})
	})

	describe("matchBlocksByPosition()", () => {
		it("pairs blocks by sequence", () => {
			const analyzer = new BlockAnalyzer({ enabled: true })
			const oldBlocks = [{ tagName: "ul", startIndex: 0, endIndex: 5, depth: 0 }]
			const newBlocks = [{ tagName: "p", startIndex: 0, endIndex: 3, depth: 0 }]

			const pairs = analyzer.matchBlocksByPosition(oldBlocks, newBlocks)
			expect(pairs).toHaveLength(1)
			expect(pairs[0].oldBlock?.tagName).toBe("ul")
			expect(pairs[0].newBlock?.tagName).toBe("p")
		})

		it("handles unequal number of blocks", () => {
			const analyzer = new BlockAnalyzer({ enabled: true })
			const oldBlocks = [
				{ tagName: "p", startIndex: 0, endIndex: 3, depth: 0 },
				{ tagName: "p", startIndex: 4, endIndex: 8, depth: 0 }
			]
			const newBlocks = [{ tagName: "p", startIndex: 0, endIndex: 5, depth: 0 }]

			const pairs = analyzer.matchBlocksByPosition(oldBlocks, newBlocks)
			expect(pairs).toHaveLength(2)
			expect(pairs[0].oldBlock).not.toBeNull()
			expect(pairs[0].newBlock).not.toBeNull()
			expect(pairs[1].oldBlock).not.toBeNull()
			expect(pairs[1].newBlock).toBeNull()
		})
	})
})
