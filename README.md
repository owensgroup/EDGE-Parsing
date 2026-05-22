# EDGE LaTeX Parser Notes

This repository parses small EDGE LaTeX examples with Unified LaTeX and lowers them into a lightweight intermediate AST. The main entry point is `generate_ast.mjs`, and most parser logic lives in `parserHelpers.mjs`.

## File Flow

`generate_ast.mjs` reads one example file, parses it with `@unified-latex/unified-latex-util-parse`, and sends the parsed LaTeX node content into `parseExpression`.

`parserHelpers.mjs` walks the Unified LaTeX nodes with a cursor and builds objects shaped like:

```json
{
  "type": "Einsum",
  "name": "Z",
  "tensors": [],
  "operator": [],
  "map": [],
  "reduce": [],
  "populate": []
}
```

## Helper Functions

### Basic Checks

`isOnlyLetters(str)` returns true when a string contains only letters. It is used to detect tensor names and rank variables.

`isOnlyDigits(str)` returns true when a string contains only digits. It is used to parse labels like `\cdot^1`, `\bigwedge^1`, and `\bigvee^2`.

### Symbol Tables

`BUILTIN_COMPUTE_SYMBOLS` maps LaTeX/parser compute tokens to normalized operator symbols. For example, `times` becomes `*`, and `mathbb{1}` becomes `pass_through`.

`BUILTIN_MERGE_SYMBOLS` maps EDGE merge symbols from the paper to normalized names. For example, `cap` becomes `intersect`, `cup` becomes `union`, and `leftarrow` becomes `take_left`.

### Text Conversion

`nodeToExpressionText(node)` converts a Unified LaTeX node into text for rank expressions. It drops whitespace, preserves ordinary string content, and writes macros with a leading backslash.

`contentToText(content)` applies `nodeToExpressionText` to a list of nodes and joins the result.

`nodeToSymbolText(node)` converts a node into text for operator symbols. Unlike rank expression text, macro names are stored without a leading backslash so they can match the symbol tables.

`contentToSymbolText(content)` applies `nodeToSymbolText` to a list of nodes and joins the result.

`normalizeFunctionName(name)` currently converts escaped underscores, such as `filter\_even`, into normal underscores, such as `filter_even`.

### Rank Parsing

`getRankExpressions(nodes)` splits a tensor subscript into one expression per comma-separated rank expression. This is what keeps `Z_{m+r, p+s}` as two rank expressions, `m+r` and `p+s`, instead of splitting it into four variables.

`getRankVariables(cur_node, tensor)` reads superscript rank names like `A^{P, L}` and stores them in the tensor's `rankList`.

`getRanks(cur_node, tensor)` reads subscript rank expressions like `A_{m, k}`. If the tensor already has superscript rank names, those names are used. Otherwise, rank names are auto-generated starting at `M`.

### Cursor

`Cursor` is a small wrapper around the Unified LaTeX node list.

`peek(offset = 0)` looks at the current node, or a future node if an offset is provided.

`advance()` returns the current node and moves forward.

`skipWhitespace()` advances over whitespace nodes.

`isDone()` checks whether the parser has reached the end of the node list.

### AST Constructors

`createEinsum(name)` creates the top-level object for one Einsum.

`createEmptyTensor(name)` creates a tensor object with empty rank metadata.

### Operator Parsing

`getArgumentText(node)` reads the text inside the first argument of a macro. It is used for superscript labels, rank lists, and text macros.

`consumeOptionalLabel(cursor)` consumes a numeric superscript label if one appears next. If no label appears, it returns `0`.

`consumeSymbolText(cursor)` reads one compute, merge, or coordinate symbol from the cursor. It handles normal macros like `\cap`, text macros like `\text{AND}`, bare `text{OR}`, barred symbols like `\bar{\cup}`, and subscripted symbols like `\ominus_l`.

`consumeUntilString(cursor, endContent)` reads nodes until a specific string token appears. It is used to read coordinate operator names inside populate parentheses, such as `filter_even`.

`createComputeOp(symbolText)` converts a parsed compute symbol into either a built-in `{ "symbol": "..." }` object or a user-defined `{ "name": "..." }` object.

`createMergeOp(symbolText)` converts a parsed merge symbol into either a built-in `{ "symbol": "..." }` object or a user-defined `{ "name": "..." }` object.

`createCoordinateOp(symbolText)` converts a coordinate operator into a built-in symbol when it is pass-through, or a user-defined name otherwise.

### Computation Specs

`consumeComputationSpec(cursor, kind)` parses map and reduce specs:

```latex
\bigwedge^1 \text{AND}(\cap)
\bigvee^2 +(\cup)
```

It returns an object with a label, `compute_op`, and `merge_op`. If the merge operator is omitted, it defaults to pass-through.

`consumeRankList(cursor)` reads a rank list attached to an action, such as the `_m` in `\lll_m`.

`consumePopulateSpec(cursor)` parses populate specs:

```latex
\lll_m \mathbb{1}(filter\_even)
```

It returns an object with a label, `rank_list`, `compute_op`, and `coord_op`.

### Top-Level Parsing

`unwrapTopLevelContent(nodes)` removes outer `displaymath` and `mathenv` wrappers so `parseExpression` can parse both simple display equations and `align` environments.

`parseExpression(rawContent)` is the main parser. It walks the Unified LaTeX nodes and builds Einsums, tensors, binary operators, map specs, reduce specs, and populate specs. Align line breaks end the current Einsum, so example 3 becomes two Einsums.

## Current Supported Examples

Example 3 demonstrates populate and a shorthand reduce:

```latex
Z_{m^*} &= I_m :: \lll_m \mathbb{1}(filter\_even) \\
Y &= Z_m :: \bigvee +
```

Current output summary:

```json
[
  {
    "name": "Z",
    "tensors": [
      {
        "role": "Output",
        "name": "Z",
        "rankVariableExpressions": {
          "M": "m^*"
        }
      },
      {
        "role": "Output1",
        "name": "I",
        "rankVariableExpressions": {
          "M": "m"
        }
      }
    ],
    "operator": [],
    "map": [],
    "reduce": [],
    "populate": [
      {
        "label": 0,
        "rank_list": ["m"],
        "compute_op": {
          "symbol": "pass_through"
        },
        "coord_op": {
          "name": "filter_even"
        }
      }
    ]
  },
  {
    "name": "Y",
    "tensors": [
      {
        "role": "Output",
        "name": "Y",
        "rankVariableExpressions": {}
      },
      {
        "role": "Output1",
        "name": "Z",
        "rankVariableExpressions": {
          "M": "m"
        }
      }
    ],
    "operator": [],
    "map": [],
    "reduce": [
      {
        "label": 0,
        "compute_op": {
          "symbol": "+"
        },
        "merge_op": {
          "symbol": "pass_through"
        }
      }
    ],
    "populate": []
  }
]
```

Example 4 demonstrates rank expressions, map, reduce, and built-in merge normalization:

```latex
Z_{m+r, p+s} = I_{m, p} \cdot F_{r, s} :: \bigwedge \times(\cap) \bigvee +(\leftarrow)
```

Current output summary:

```json
[
  {
    "name": "Z",
    "tensors": [
      {
        "role": "Output",
        "name": "Z",
        "rankVariableExpressions": {
          "M": "m+r",
          "N": "p+s"
        }
      },
      {
        "role": "Output1",
        "name": "I",
        "rankVariableExpressions": {
          "M": "m",
          "N": "p"
        }
      },
      {
        "role": "Output2",
        "name": "F",
        "rankVariableExpressions": {
          "M": "r",
          "N": "s"
        }
      }
    ],
    "operator": [
      {
        "symbol": "cdot",
        "label": 0
      }
    ],
    "map": [
      {
        "label": 0,
        "compute_op": {
          "symbol": "*"
        },
        "merge_op": {
          "symbol": "intersect"
        }
      }
    ],
    "reduce": [
      {
        "label": 0,
        "compute_op": {
          "symbol": "+"
        },
        "merge_op": {
          "symbol": "take_left"
        }
      }
    ],
    "populate": []
  }
]
```

Example 5 demonstrates labels and user-defined compute operators:

```latex
Z_{s, d} = (G_{s, d} \cdot^1 F_s)_{s, d} \cdot^2 V_d :: \bigwedge^1 \text{AND}(\cap) \bigvee^2 text{OR}(\cup)
```

Current output summary:

```json
[
  {
    "name": "Z",
    "tensors": [
      {
        "role": "Output",
        "name": "Z",
        "rankVariableExpressions": {
          "M": "s",
          "N": "d"
        }
      },
      {
        "role": "Output1",
        "name": "G",
        "rankVariableExpressions": {
          "M": "s",
          "N": "d"
        }
      },
      {
        "role": "Output2",
        "name": "F",
        "rankVariableExpressions": {
          "M": "s"
        }
      },
      {
        "role": "Output3",
        "name": "V",
        "rankVariableExpressions": {
          "M": "d"
        }
      }
    ],
    "operator": [
      {
        "symbol": "cdot",
        "label": 1
      },
      {
        "symbol": "cdot",
        "label": 2
      }
    ],
    "map": [
      {
        "label": 1,
        "compute_op": {
          "name": "AND"
        },
        "merge_op": {
          "symbol": "intersect"
        }
      }
    ],
    "reduce": [
      {
        "label": 2,
        "compute_op": {
          "name": "OR"
        },
        "merge_op": {
          "symbol": "union"
        }
      }
    ],
    "populate": []
  }
]
```
