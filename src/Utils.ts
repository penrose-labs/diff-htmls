const tagRegex = /^\s*<\/?[^>]+>\s*$/
const tagWordRegex = /<[^\s>]+/
const whitespaceRegex = /^(\s|&nbsp;)+$/
const wordRegex = /[\w\#@]+/

const specialCaseWordTags = ["<img"]

// Block-level elements that should be compared as whole units when their type changes
const blockLevelElements = new Set([
	"p",
	"div",
	"ul",
	"ol",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"pre",
	"table",
	"tr",
	"td",
	"th",
	"thead",
	"tbody",
	"tfoot",
	"article",
	"section",
	"aside",
	"header",
	"footer",
	"nav",
	"main",
	"figure",
	"figcaption",
	"dl",
	"dt",
	"dd"
])

function isTag(item: string) {
	if (specialCaseWordTags.some((re) => item !== null && item.startsWith(re))) {
		return false
	}

	return tagRegex.test(item)
}

function stripTagAttributes(word: string) {
	let tags = tagWordRegex.exec(word) || [""]
	word = tags[0] + (word.endsWith("/>") ? "/>" : ">")
	return word
}

function wrapText(text: string, tagName: string, cssClass: string) {
	return ["<", tagName, ' class="', cssClass, '">', text, "</", tagName, ">"].join("")
}

function isStartOfTag(val: string) {
	return val === "<"
}

function isEndOfTag(val: string) {
	return val === ">"
}

function isStartOfEntity(val: string) {
	return val === "&"
}

function isEndOfEntity(val: string) {
	return val === ";"
}

function isWhiteSpace(value: string) {
	return whitespaceRegex.test(value)
}

function stripAnyAttributes(word: string) {
	if (isTag(word)) {
		return stripTagAttributes(word)
	}

	return word
}

function isNumber(text: string) {
	return /^\d$/.test(text)
}

function isWord(text: string) {
	return wordRegex.test(text)
}

/**
 * Extracts the tag name from an HTML tag string
 * e.g., "<p>" -> "p", "</ul>" -> "ul", "<div class='foo'>" -> "div"
 */
function getTagName(tag: string): string | null {
	const match = tag.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/i)
	return match ? match[1].toLowerCase() : null
}

/**
 * Checks if a tag is a block-level element
 */
function isBlockLevelTag(tag: string): boolean {
	const tagName = getTagName(tag)
	return tagName !== null && blockLevelElements.has(tagName)
}

/**
 * Checks if a tag is an opening tag (not a closing tag)
 */
function isOpeningTag(tag: string): boolean {
	return isTag(tag) && !tag.startsWith("</") && !tag.endsWith("/>")
}

/**
 * Checks if a tag is a closing tag
 */
function isClosingTag(tag: string): boolean {
	return isTag(tag) && tag.startsWith("</")
}

/**
 * Checks if a tag is a self-closing tag
 */
function isSelfClosingTag(tag: string): boolean {
	return isTag(tag) && tag.endsWith("/>")
}

export {
	isTag,
	stripTagAttributes,
	wrapText,
	isStartOfTag,
	isEndOfTag,
	isStartOfEntity,
	isEndOfEntity,
	isWhiteSpace,
	stripAnyAttributes,
	isWord,
	isNumber,
	getTagName,
	isBlockLevelTag,
	isOpeningTag,
	isClosingTag,
	isSelfClosingTag,
	blockLevelElements
}
