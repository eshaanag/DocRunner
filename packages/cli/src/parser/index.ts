import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { toString } from "mdast-util-to-string";
import type { Code, Heading, Html, Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node, Parent } from "unist";
import { normalizeLanguage } from "./languageNormalizer.js";
import { detectSkipReason } from "./skipDetector.js";
import type { ParsedBlock } from "../types/index.js";

export interface ParseMarkdownOptions {
  file: string;
  skipPatterns?: readonly string[] | undefined;
}

interface ParseState {
  blocks: ParsedBlock[];
  heading: string | null;
  options: ParseMarkdownOptions;
}

interface Directives {
  skip: boolean;
  setup: boolean;
  name: string | null;
}

const EMPTY_DIRECTIVES: Readonly<Directives> = {
  skip: false,
  setup: false,
  name: null,
};

/**
 * Parses supported fenced code blocks from markdown content.
 * @param markdown Raw markdown content.
 * @param options Source file and configured skip patterns.
 * @returns Parsed supported code blocks in source order.
 */
export function parseMarkdown(
  markdown: string,
  options: ParseMarkdownOptions,
): ParsedBlock[] {
  const tree = unified().use(remarkParse).parse(markdown) as Root;
  const state: ParseState = {
    blocks: [],
    heading: null,
    options,
  };

  processChildren(tree, state);
  return state.blocks;
}

/**
 * Reads and parses supported fenced code blocks from a markdown file.
 * @param path Path to the markdown file.
 * @param options Source file label and configured skip patterns.
 * @returns Parsed supported code blocks in source order.
 */
export async function parseMarkdownFile(
  path: string,
  options: ParseMarkdownOptions,
): Promise<ParsedBlock[]> {
  try {
    const markdown = await readFile(path, "utf8");
    return parseMarkdown(markdown, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `Unable to parse markdown file ${options.file}: ${message}`,
      {
        cause: error,
      },
    );
  }
}

/**
 * Walks one AST parent's children in source order.
 * @param parent Parent node whose children should be processed.
 * @param state Shared parser state.
 * @returns Nothing.
 */
function processChildren(parent: Parent, state: ParseState): void {
  for (const [index, child] of parent.children.entries()) {
    if (isHeading(child) && child.depth <= 3) {
      state.heading = toString(child).trim() || null;
    }

    if (isCode(child)) {
      const language = normalizeLanguage(child.lang);
      if (language !== null) {
        const directives = collectDirectives(parent.children, index);
        const startLine = child.position?.start.line ?? 1;
        const skipReason = directives.skip
          ? "manual skip directive"
          : detectSkipReason(child.value, state.options.skipPatterns);

        state.blocks.push({
          id: createBlockId(
            state.options.file,
            startLine,
            language,
            child.value,
          ),
          file: state.options.file,
          language,
          code: child.value,
          startLine,
          heading: state.heading,
          name: directives.name,
          isSetup: directives.setup,
          skipReason,
        });
      }
    }

    if (isParent(child)) {
      processChildren(child, state);
    }
  }
}

/**
 * Collects contiguous HTML directives immediately before a code node.
 * @param siblings Sibling nodes containing the code node.
 * @param codeIndex Index of the code node.
 * @returns Parsed skip, setup, and name directives.
 */
function collectDirectives(
  siblings: readonly Node[],
  codeIndex: number,
): Directives {
  const htmlValues: string[] = [];

  for (let index = codeIndex - 1; index >= 0; index -= 1) {
    const sibling = siblings[index];
    if (sibling === undefined || !isHtml(sibling)) {
      break;
    }
    htmlValues.unshift(sibling.value);
  }

  if (htmlValues.length === 0) {
    return { ...EMPTY_DIRECTIVES };
  }

  return htmlValues.reduce<Directives>(
    (directives, html) => ({
      skip: directives.skip || /<!--\s*docrunner:\s*skip\s*-->/u.test(html),
      setup: directives.setup || /<!--\s*docrunner:\s*setup\s*-->/u.test(html),
      name: extractName(html) ?? directives.name,
    }),
    { ...EMPTY_DIRECTIVES },
  );
}

/**
 * Extracts a name override from an HTML directive.
 * @param html HTML node value.
 * @returns Name override or null when absent.
 */
function extractName(html: string): string | null {
  const match = /<!--\s*docrunner:\s*name="([^"]+)"\s*-->/u.exec(html);
  return match?.[1]?.trim() || null;
}

/**
 * Creates a deterministic identifier for a parsed code block.
 * @param file Source markdown file.
 * @param line Starting line of the fenced block.
 * @param language Normalized language.
 * @param code Raw code content.
 * @returns Stable shortened SHA-256 identifier.
 */
function createBlockId(
  file: string,
  line: number,
  language: string,
  code: string,
): string {
  return createHash("sha256")
    .update(`${file}\0${line}\0${language}\0${code}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Checks whether an AST node is a heading.
 * @param node AST node.
 * @returns True for heading nodes.
 */
function isHeading(node: Node): node is Heading {
  return node.type === "heading";
}

/**
 * Checks whether an AST node is fenced or indented code.
 * @param node AST node.
 * @returns True for code nodes.
 */
function isCode(node: Node): node is Code {
  return node.type === "code";
}

/**
 * Checks whether an AST node is raw HTML.
 * @param node AST node.
 * @returns True for HTML nodes.
 */
function isHtml(node: Node): node is Html {
  return node.type === "html";
}

/**
 * Checks whether an AST node contains child nodes.
 * @param node AST node.
 * @returns True for parent nodes.
 */
function isParent(node: Node): node is Parent {
  return "children" in node && Array.isArray(node.children);
}
