#!/usr/bin/env node
/**
 * Concatenate all markdown under content/docs into public/llms.txt for AI consumption.
 * Strips YAML frontmatter and adds section headers per file.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR = join(ROOT, "content", "docs");
const OUTPUT = join(ROOT, "public", "llms.txt");

/**
 * @param {string} content
 * @returns {string}
 */
function stripFrontmatter(content) {
  if (!content.startsWith("---")) {
    return content.trim();
  }

  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return content.trim();
  }

  const after = content.slice(end + 4);
  return after.replace(/^\s*\n/, "").trim();
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function titleFromPath(filePath) {
  const rel = relative(DOCS_DIR, filePath);
  const withoutExt = rel.replace(/\.md$/i, "");
  if (withoutExt === "index") {
    return "Documentation";
  }
  return withoutExt
    .split(sep)
    .map((part) =>
      part === "index"
        ? null
        : part
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .filter(Boolean)
    .join(" / ");
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function collectMarkdownFiles(dir) {
  /** @type {string[]} */
  const files = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (entry.endsWith(".md")) {
      files.push(full);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function main() {
  const files = collectMarkdownFiles(DOCS_DIR);

  if (files.length === 0) {
    console.error(`No markdown files found under ${DOCS_DIR}`);
    process.exit(1);
  }

  const sections = files.map((filePath) => {
    const raw = readFileSync(filePath, "utf8");
    const body = stripFrontmatter(raw);
    const title = titleFromPath(filePath);
    const relPath = relative(ROOT, filePath);

    return [`## ${title}`, "", `Source: ${relPath}`, "", body, ""].join("\n");
  });

  const header = [
    "# PagesCMS documentation (llms.txt)",
    "",
    "Machine-readable export of content/docs for AI agents and setup skills.",
    "Regenerate with: pnpm run generate:llms-txt",
    "",
    "---",
    "",
  ].join("\n");

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, header + sections.join("\n---\n\n"), "utf8");

  console.log(`Wrote ${relative(ROOT, OUTPUT)} (${files.length} files)`);
}

main();
