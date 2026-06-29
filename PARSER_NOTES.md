# Quick note on the parser: one change and one small bug

*(reviewed with claude code)*

Went through the parser with the BFS examples and it's in really good shape. The operator tables, the labels, and the map/reduce/populate stuff all look great. There's basically one change I want, plus one small bug. Let me walk through it.

## The one change: nest the expression instead of two flat lists

Right now, for a line like:

```
F_{d} = T_{d} \cdot \neg P_{d} :: \bigwedge \leftarrow(\cap)
```

the parser spits out two separate piles, a `tensors` list and an `operator` list:

```jsonc
{
  "name": "F",
  "tensors":  [ {"name":"F", ...}, {"name":"T", ...}, {"name":"P", ...} ],
  "operator": [ {"symbol":"cdot"}, {"symbol":"neg"} ],
  "map": [ {"compute_op":{"name":"leftarrow"}, "merge_op":{"symbol":"intersect"}} ]
}
```

Issue: the `\neg` is just sitting in the operator pile. Nothing says what it's negating. Reading this back, I can't tell if it's `not P` or `not T`. That info is gone. The same thing happens with parentheses like `(A · B) · C`: the grouping disappears. 

What I want instead is to put each tensor inside the operator it belongs to, like boxes in boxes:

```jsonc
{
  "name": "F",
  "output": {"name":"F", "ranks":["i+1","d"]},
  "expression": {
    "kind": "op", "symbol": "cdot",
    "left":  {"kind":"tensor", "name":"T", "ranks":["i","d"]},
    "right": {
      "kind": "unary", "symbol": "neg",
      "operand": {"kind":"tensor", "name":"P", "ranks":["i","d"]}
    }
  },
  "map": [ {"compute_op":{"name":"leftarrow"}, "merge_op":{"symbol":"intersect"}} ]
}
```

Now the `neg` literally holds the `P` inside it. No more guessing.

You already build tensor-boxes and operator-boxes. Today you drop them into two parallel lists. The change is just to nest them, so each tensor goes into the `left`, `right`, or `operand` slot of the operator it pairs with, instead of into a separate list. (The exact field names like `left`, `right`, and `kind` are flexible, we can figure those out together. The thing that matters is the nesting.)

These should stay the same: your tensor objects (name, rankList, rankVariableExpressions, all of it), the operator symbol tables, and the `map`, `reduce`, and `populate` lists. The only thing that goes away is the flat `tensors` plus `operator` lists, replaced by one nested `expression`.

This also fixes the weird `role: "Output2"` and `"Output3"` labels on the inputs. Once things are nested, there's no flat list to mislabel, so that just disappears on its own.

## The one small bug: subscripts on ⋀ / ⋁

When a map or reduce has a subscript, like `\bigwedge_{d}` or `\bigvee_{s}`, the parser trips and reads the `_{d}` as if it were the compute operator. (You can see it: feed it `ex01` vs `ex01b` in `more-examples/` and compare.) That subscript names the rank the action runs over, so we want to keep it. The fix: when you hit `\bigwedge` or `\bigvee`, if the next thing is a `_{...}`, read it in and store it on that map or reduce spec as its rank, the same way your populate spec already carries `rank_list`. Then carry on to the compute op. Your populate code already does this, so you can mirror that logic.

## How to test
I had claude generate more examples in `more-examples/` (with a README), smallest first. Run any of them with:

```
node run_examples.mjs more-examples/ex02b_bare_unary.txt
```

Start with `ex01b` and `ex02b` (the bare ones, these mostly work today), then try `ex01` and `ex02` to see the subscript bug, then `ex03` for the nested and parentheses case. Once the `expression` nesting is in and the subscript is kept, `ex01`, `ex02`, and `ex03` should all come out clean.

That's really it: nest the expression, and keep the spec subscript. Everything else you built stays. Lmk when you want to look at it together!
