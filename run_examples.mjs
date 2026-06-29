// Minimal argv-aware runner so we can parse any example file:
//   node run_examples.mjs more-examples/ex01_subscripted_specs.txt
// (generate_ast.mjs hardcodes INPUT_FILE; this is the only difference.)

import * as fs from "fs";
import { getParser } from "@unified-latex/unified-latex-util-parse";
import { parseExpression } from "./parserHelpers.mjs";

const file = process.argv[2] || "example1_tester_code.txt";
const raw = fs.readFileSync(file, "utf8");
console.log("Input:", file, "\n", raw);

const parser = getParser();
const parsed = parser.parse(raw);

const all = [];
for (const node of parsed.content || []) {
    const ast = parseExpression(node.content);
    if (Array.isArray(ast)) all.push(...ast);
}

console.log("\n=== FULL AST LIST (" + all.length + " einsum(s)) ===");
console.log(JSON.stringify(all, null, 2));
