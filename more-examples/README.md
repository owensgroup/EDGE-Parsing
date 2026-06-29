# More EDGE LaTeX examples

A graded test suite for the parser, smallest first. Each file is a single
`$$ ... $$` block, drop-in for `generate_ast.mjs` — set `INPUT_FILE` to the
path, e.g. `INPUT_FILE = "more-examples/ex01_subscripted_specs.txt"`.

The `_{s}`/`_{d}` subscript on `\bigwedge`/`\bigvee` is **optional** in EDGE, so
several examples come in two flavors: subscripted (`exNN`) and bare (`exNNb`).
Bare is the canonical short form; both must parse to the same AST. The pair
isolates exactly the "subscripted-spec" handling.

| File | Exercises | What to watch |
|------|-----------|---------------|
| `ex01_subscripted_specs` | map + reduce **with** `\bigwedge_{s}` / `\bigvee_{s}` | does the `_{s}` get consumed, or mistaken for the compute symbol? |
| `ex01b_bare_specs` | same einsum, **bare** `\bigwedge` / `\bigvee` | the form that already works — baseline to diff against ex01 |
| `ex02_unary_neg` | unary `\neg P` (subscripted map) | unary operand — flat `tensors[]`/`operator[]` has nowhere to put it |
| `ex02b_bare_unary` | unary `\neg P`, bare spec | isolates the unary issue from the subscript issue |
| `ex03_anon_nested_labels` | anonymous tensor `(...)_{i,d}`, two labels `\cdot^1/\cdot^2`, subscripted specs | nested sub-expression with its own subscript; multiple `\bigwedge^k` |
| `ex03b_bare_anon_labels` | same, bare specs (labels kept) | nesting + labels without the subscript noise |
| `ex04_init_membership` | init einsum, `s \in id` predicate in the subscript | restricted-iteration tail after `:` — not a rank expression |
| `ex05_iter_equality` | `k:k=2`, `s:s=2` equality restrictions in subscripts | predicate `:` inside a subscript, mixed with normal ranks |
| `ex06_declarations` | tensor decls: `\equiv` shape bind, `\rightarrow` type, `empty=` | `\rightarrow` is overloaded (here = "maps to type", elsewhere = take-right merge) |
| `ex07_populate_coordop` | `\lll` populate, starred rank `s^{*}`, coord op | populate path + the `*` marker |
| `ex08_full_bfs_subscripted` | full program: decls + init + cascade + `\diamond` stopping | everything at once, subscripted specs |
| `ex08b_full_bfs_bare` | full BFS, bare specs | end-to-end target in the canonical short form |

## Suggested order
1. `ex01b` / `ex02b` — confirm the bare baseline still parses.
2. `ex01` / `ex02` — add subscripts; see what breaks.
3. `ex04` / `ex05` — subscript predicates (`\in`, `:k=2`).
4. `ex03` — nested/anonymous tensors + multi-label.
5. `ex06` / `ex07` — declarations and populate.
6. `ex08` / `ex08b` — the whole BFS program, both flavors.

All expressions are taken from (or built to match) the EDGE paper's BFS,
Bellman-Ford, and Dijkstra examples, so they use real macros: `\bigwedge`,
`\bigvee`, `\lll`, `\neg`, `\leftarrow`, `\cdot^k`, `\equiv`, `\diamond`,
`\in`, `\text{...}`, `\mathbbm{1}`.
