# EDGE Language Parsing Overview

The parser built for EDGE utilizes a prebuilt parser for LaTeX called Unified LaTeX. This parser is run with Node.js and creates a JSON AST. To modify this parser for EDGE-specific syntax, the generated AST goes through an extra layer of parsing where a new AST is formed in the correct IR representation.

# Why Unified LaTeX

Several parsers were tested for this project. Here is more detailed information about each:
https://docs.google.com/document/d/1d088863EpijZAF6IxSw1R7SSq_t3QRyihBjuEHho1lM/edit?usp=sharing

A summary of the doc:

The core challenge with LaTeX parsing is that LaTeX is not context-free and its grammar changes based on macro definitions and environment rules, which makes it difficult to write a single clean grammar for it.

Seven parsers were evaluated:

- **ANTLR**: Generates a parser and tree-walker from a grammar you write yourself. Flexible, but community LaTeX grammars were incomplete and struggled with subscript syntax like `Z_{m, n}`.
- **YACC/LEX**: Fast, but too rigid and complex for a context-sensitive language like LaTeX. Skipped.
- **Lark**: Similar to ANTLR — you write the grammar, it handles parsing. Python-based and supports multiple parsing strategies (LL\*, LALR, CYK), but the Python dependency was a drawback.
- **TreeSitter**: Has an existing (though incomplete) LaTeX grammar. Generates a C parser, which made cross-language integration harder.
- **Latex Math Parser**: Targeted at converting LaTeX math to Maxima syntax. Got stuck on `$$` delimiters and lacked subscript support needed for EDGE.
- **PyLatexenc**: Python library with a node walker. Produced a clean, simple AST, but the output was minimal and would require significant modification to capture EDGE-specific structure.
- **Unified LaTeX**: JavaScript/npm library. Generates a structured JSON AST without excess metadata, handles the specific LaTeX subset EDGE uses, and is straightforward to extend.

PyLatexenc and Unified LaTeX had the best overall results. Unified LaTeX was ultimately preferred because its JSON output maps more naturally to IR construction. It also identified the specific subset of LaTeX needed, was relatively fast, and is easily modifiable.

# How the current program works

There are two main files used by this program: `parserHelpers.mjs` and `generate_ast.mjs`.

**generate_ast.mjs**

The main entry point and orchestrator. It reads a LaTeX input file, passes the raw content through Unified LaTeX's `getParser` to produce a generic JSON AST, and then hands each top-level math block to `parseExpression` from `parserHelpers.mjs`. It also contains `printEdgeAst`, a debug utility that pretty-prints the resulting EDGE AST to the console.

**parserHelpers.mjs**

Contains all of the EDGE-specific parsing logic. The main export is `parseExpression`, which takes Unified LaTeX's raw node list and converts it into EDGE's own AST structure. Internally it uses a `Cursor` class to walk through nodes one at a time, and builds up `Einsum` and `Tensor` objects as it goes. It handles operators (`\cdot`), map specs (`\bigwedge`), reduce specs (`\bigvee`), and populate specs (`\lll`). Two lookup tables — `BUILTIN_COMPUTE_SYMBOLS` and `BUILTIN_MERGE_SYMBOLS` — resolve standard LaTeX symbols to their EDGE equivalents, and any unrecognized symbol is flagged as user-defined with a warning.

# Challenges with this project

As mentioned previously, EDGE uses a specific subset/syntax of LaTeX, and sometimes Unified LaTeX would fail to catch these specificities. For instance, EDGE uses symbols like `no_pass` and `pass_through`, which are not standard across LaTeX. Therefore, extra parsing logic had to be added to find these values. Additionally, because LaTeX is not context-free, edge cases in syntax (such as missing operators or unlabeled reduction specs) required explicit error and warning handling to be layered on top of the parser output.

# Future Plans

The next steps for this parsing code are to shape the JSON output to fit the EDGE-specific IR and integrate it with the compiler pipeline. Additionally, testing with larger segments of code will be needed to ensure the parser gathers information correctly at scale.
