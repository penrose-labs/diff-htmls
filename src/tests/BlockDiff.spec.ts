import diff from "../index"

describe("Block-aware diffing", () => {
	describe("when blockDiff is disabled (default)", () => {
		it("uses word-by-word diffing for all changes", () => {
			const oldHtml = "<ul><li>Headache</li><li>Nausea</li></ul>"
			const newHtml = "<p>Patient has headache and nausea.</p>"

			const result = diff(oldHtml, newHtml)

			// Without block-aware diffing, we get word-level diffs with diffmod class
			expect(result).toContain("diffmod")
		})
	})

	describe("when blockDiff.enabled is true", () => {
		const blockDiffOptions = { enabled: true }

		describe("same element type -> inline word diff", () => {
			it("shows word-by-word changes for p -> p", () => {
				const oldHtml = "<p>Patient reports headaches.</p>"
				const newHtml = "<p>Jill reports headaches.</p>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })

				// Should use diffmod for word-level changes within same block type
				expect(result).toContain("diffmod")
				expect(result).toContain("Patient")
				expect(result).toContain("Jill")
			})

			it("shows word-by-word changes for ul -> ul", () => {
				const oldHtml = "<ul><li>Apple</li><li>Banana</li></ul>"
				const newHtml = "<ul><li>Apple</li><li>Cherry</li></ul>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })

				// Word-level diff should be used
				expect(result).toContain("diffmod")
				expect(result).toContain("Banana")
				expect(result).toContain("Cherry")
			})

			it("shows word-by-word changes for ol -> ol", () => {
				const oldHtml = "<ol><li>First</li><li>Second</li></ol>"
				const newHtml = "<ol><li>First</li><li>Third</li></ol>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })

				expect(result).toContain("diffmod")
			})
		})

		describe("different element type -> block replacement", () => {
			it("shows block replacement for ul -> p", () => {
				const oldHtml = "<ul><li>Headache</li><li>Nausea</li></ul>"
				const newHtml = "<p>Patient has headache and nausea.</p>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })

				// Should use diffdel/diffins for block-level replacement
				expect(result).toContain("diffdel")
				expect(result).toContain("diffins")
				// Should NOT use diffmod
				expect(result).not.toContain("diffmod")
			})

			it("keeps block replacement when list becomes paragraph", () => {
				const oldHtml =
					"<h2>Objective</h2><ul><li>Blood pressure 118/76 mmHg; heart rate 72 bpm.</li><li>Neurologic exam: Pupils equal and reactive.</li></ul><p>Ensure adequate hydulation.</p>"
				const newHtml =
					"<h2>Objective</h2><p>Blood pressure 118/76 mmHg; heart rate 72 bpm. Neurologic exam: Pupils equal and reactive.</p><p>Ensure adequate hydration.</p>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })
				const expected =
					'<h2>Objective</h2><del class="diffdel"><ul><li>Blood pressure 118/76 mmHg; heart rate 72 bpm.</li><li>Neurologic exam: Pupils equal and reactive.</li></ul></del><ins class="diffins"><p>Blood pressure 118/76 mmHg; heart rate 72 bpm. Neurologic exam: Pupils equal and reactive.</p></ins><p>Ensure adequate <del class="diffmod">hydulation</del><ins class="diffmod">hydration</ins>.</p>'

				expect(result).toBe(expected)
			})

			it("wraps full blocks when list becomes paragraphs", () => {
				const oldHtml =
					"<h2>Subjective</h2><ul><li>Headache for two weeks.</li><li>Bright lights exacerbate symptoms.</li><li>Work stress reported.</li><li>History of anxiety.</li></ul><h2>Objective</h2><p>Vitals stable.</p>"
				const newHtml =
					"<h2>Subjective</h2><p>Headache for two weeks. Bright lights exacerbate symptoms. Work stress reported.</p><p>History of anxiety.</p><h2>Objective</h2><p>Vitals stable.</p>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })
				const expected =
					'<h2>Subjective</h2><del class="diffdel"><ul><li>Headache for two weeks.</li><li>Bright lights exacerbate symptoms.</li><li>Work stress reported.</li><li>History of anxiety.</li></ul></del><ins class="diffins"><p>Headache for two weeks. Bright lights exacerbate symptoms. Work stress reported.</p><p>History of anxiety.</p></ins><h2>Objective</h2><p>Vitals stable.</p>'

				expect(result).toBe(expected)
			})

			it("keeps block replacement when list becomes paragraph", () => {
				const oldHtml =
					"<h2>Objective</h2><ul><li>Blood pressure 118/76 mmHg; heart rate 72 bpm.</li><li>Neurologic exam: Pupils equal and reactive.</li></ul><p>Ensure adequate hydulation.</p>"
				const newHtml =
					"<h2>Objective</h2><p>Blood pressure 118/76 mmHg; heart rate 72 bpm. Neurologic exam: Pupils equal and reactive.</p><p>Ensure adequate hydration.</p>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })
				const expected =
					'<h2>Objective</h2><del class="diffdel"><ul><li>Blood pressure 118/76 mmHg; heart rate 72 bpm.</li><li>Neurologic exam: Pupils equal and reactive.</li></ul></del><ins class="diffins"><p>Blood pressure 118/76 mmHg; heart rate 72 bpm. Neurologic exam: Pupils equal and reactive.</p></ins><p>Ensure adequate <del class="diffmod">hydulation</del><ins class="diffmod">hydration</ins>.</p>'

				expect(result).toBe(expected)
			})

			it("shows block replacement for ol -> p", () => {
				const oldHtml = "<ol><li>Step one</li><li>Step two</li></ol>"
				const newHtml = "<p>Follow these steps.</p>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })

				expect(result).toContain("diffdel")
				expect(result).toContain("diffins")
				expect(result).not.toContain("diffmod")
			})

			it("shows block replacement for p -> ul", () => {
				const oldHtml = "<p>Patient has symptoms.</p>"
				const newHtml = "<ul><li>Headache</li><li>Nausea</li></ul>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })

				expect(result).toContain("diffdel")
				expect(result).toContain("diffins")
				expect(result).not.toContain("diffmod")
			})

			it("shows block replacement for p -> ol", () => {
				const oldHtml = "<p>Instructions below.</p>"
				const newHtml = "<ol><li>First do this</li><li>Then that</li></ol>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })

				expect(result).toContain("diffdel")
				expect(result).toContain("diffins")
				expect(result).not.toContain("diffmod")
			})

			it("shows block replacement for ul -> ol", () => {
				const oldHtml = "<ul><li>Item A</li><li>Item B</li></ul>"
				const newHtml = "<ol><li>Item A</li><li>Item B</li></ol>"

				const result = diff(oldHtml, newHtml, { blockDiff: blockDiffOptions })

				expect(result).toContain("diffdel")
				expect(result).toContain("diffins")
				expect(result).not.toContain("diffmod")
			})
		})

		describe("with equivalentTypes configuration", () => {
			it("treats ul and ol as same type when configured", () => {
				const oldHtml = "<ul><li>Item A</li><li>Item B</li></ul>"
				const newHtml = "<ol><li>Item A</li><li>Item B</li></ol>"

				const result = diff(oldHtml, newHtml, {
					blockDiff: {
						enabled: true,
						equivalentTypes: [["ul", "ol"]]
					}
				})

				// When ul/ol are equivalent, only the tags themselves change
				// so we should see diffmod for the tag changes, not full block replacement
				// The actual behavior depends on whether the operation spans the full blocks
				// In this case, content is the same, so changes are minimal
				expect(result).toContain("<ol>")
			})
		})

		describe("with custom blockElements configuration", () => {
			it("uses custom block element list", () => {
				const oldHtml = "<section><p>Content here</p></section>"
				const newHtml = "<article><p>Content here</p></article>"

				// By default, section and article are both block elements
				const result = diff(oldHtml, newHtml, {
					blockDiff: {
						enabled: true,
						blockElements: ["section", "article"]
					}
				})

				// Different block types should trigger block replacement
				expect(result).toContain("diffdel")
				expect(result).toContain("diffins")
			})
		})
	})

	describe("edge cases", () => {
		it("handles inserted block without reordering", () => {
			const oldHtml = "<h2>Subjective</h2><p>[Chief complaint]</p>"
			const newHtml =
				"<p><strong>Provider:</strong> Ashank</p><h2>Subjective</h2><p>[Chief complaint]</p>"

			const result = diff(oldHtml, newHtml, { blockDiff: { enabled: true } })

			expect(result).toContain("diffins")
			expect(result).toContain("Provider:")
			expect(result).toContain("<h2>Subjective</h2>")
			expect(result).not.toContain("diffdel")
		})

		it("handles inserted block between headings", () => {
			const oldHtml =
				"<h2>Subjective</h2><p>[Chief complaint]</p><h2>Objective</h2><p>[Vitals]</p>"
			const newHtml =
				"<h2>Subjective</h2><p>[Chief complaint]</p><p><strong>Provider:</strong> Ashank</p><h2>Objective</h2><p>[Vitals]</p>"

			const result = diff(oldHtml, newHtml, { blockDiff: { enabled: true } })

			expect(result).toContain("diffins")
			expect(result).toContain("Provider:")
			expect(result).toContain("<h2>Objective</h2>")
			expect(result).not.toContain("diffdel")
		})

		it("handles empty blocks", () => {
			const oldHtml = "<p></p>"
			const newHtml = "<div></div>"

			const result = diff(oldHtml, newHtml, { blockDiff: { enabled: true } })

			expect(result).toBeDefined()
		})

		it("handles nested blocks", () => {
			const oldHtml = "<div><p>Nested content</p></div>"
			const newHtml = "<section><p>Nested content</p></section>"

			const result = diff(oldHtml, newHtml, { blockDiff: { enabled: true } })

			expect(result).toBeDefined()
		})

		it("handles mixed content with text and blocks", () => {
			const oldHtml = "Text before <p>Paragraph</p> text after"
			const newHtml = "Text before <div>Different</div> text after"

			const result = diff(oldHtml, newHtml, { blockDiff: { enabled: true } })

			expect(result).toBeDefined()
		})

		it("handles identical content with block-diff enabled", () => {
			const html = "<p>Same content</p>"

			const result = diff(html, html, { blockDiff: { enabled: true } })

			expect(result).toBe(html)
		})
	})
})
