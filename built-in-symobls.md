## Unary

$\not$ OR $\neg$ --> "not" in the Core IR

## Merge Operators
- See Appendix A of the EDGE Paper: [Link](https://github.com/owensgroup/EDGE_Notation_Paper/blob/main/tex/appendix/0-merge.tex)
- Each of those maps to: (see the program.json.schema: [folder](https://github.com/owensgroup/edge-ir-interpreter/tree/main/edge_ir) 
  ```json       
  "symbol": {
          "enum": [
            "pass_through",
            "no_pass",
            "intersect",
            "take_left_only",
            "take_left",
            "take_right_only",
            "take_right",
            "xor",
            "union",
            "nor",
            "xnor",
            "not_right",
            "not_left",
            "implies_left",
            "implies_right",
            "nand"
          ],
  }
  ``` 
