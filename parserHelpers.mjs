/*
parserHelpers.mjs - Helper file for EDGE parsing

This file has a class called Cursor which is used to index throught the raw parsed data from Unified Parser. 
It also contains a bunch of helper functions for EDGE parsing that may be reused in the future. 
*/


const isOnlyLetters = (str) => str && /^[a-z]+$/i.test(str);
const isOnlyDigits = (str) => str && /^\d+$/.test(str);

const BUILTIN_COMPUTE_SYMBOLS = {
    "+": "+",
    "-": "-",
    "*": "*",
    "/": "/",
    "mathbb{1}": "pass_through",
    "mathbbm{1}": "pass_through",
    times: "*",
    div: "/"
};

const BUILTIN_MERGE_SYMBOLS = {
    "mathbb{1}": "pass_through",
    "mathbbm{1}": "pass_through",
    "mathbb{T}": "pass_through",
    "mathbb{F}": "no_pass",
    cap: "intersect",
    leftarrow: "take_left",
    ominus_l: "take_left_only",
    rightarrow: "take_right",
    ominus_r: "take_right_only",
    oplus: "xor",
    cup: "union",
    "bar{cup}": "nor",
    equiv: "xnor",
    leftrightarrow: "xnor",
    nrightarrow: "not_right",
    nleftarrow: "not_left",
    Leftarrow: "implies_left",
    Rightarrow: "implies_right",
    "bar{cap}": "nand"
};

function nodeToExpressionText(node) {
    if (node.type === "whitespace") {
        return "";
    }

    if (node.type === "macro") {
        return `\\${node.content}`;
    }

    return node.content ?? "";
}

function getRankExpressions(nodes) {
    const expressions = [];
    let currentExpression = "";

    for (const node of nodes) {
        if (node.type === "string" && node.content === ",") {
            if (currentExpression !== "") {
                expressions.push(currentExpression);
                currentExpression = "";
            }
            continue;
        }

        currentExpression += nodeToExpressionText(node);
    }

    if (currentExpression !== "") {
        expressions.push(currentExpression);
    }

    return expressions;
}

class Cursor {
    constructor(nodes) {
        this.nodes = nodes;
        this.pos = 0;
    }

    peek(offset = 0) {
        return this.nodes[this.pos + offset];
    }

    advance() {
        return this.nodes[this.pos++];         
    }

    skipWhitespace() {
        while (this.pos < this.nodes.length && this.nodes[this.pos].type === "whitespace") {
            this.pos++;
        }
    }

    isDone() {
        return this.pos >= this.nodes.length;
    }
}

function createEinsum(name) {
    return {
        type: "Einsum",
        name: name,
        tensors: [],
        operator: [],                          
        map: [],
        reduce: [],
        populate: []
    };
}

function createEmptyTensor(name) {
    return {
        type: "Tensor",
        role: "Null",
        name: name,
        rankList: [],
        rankVariableExpressions: {}
    };
}

function getRankVariables(cur_node, tensor) {
    const rank_variables = cur_node.args[0].content;
    for (const v of rank_variables) {
        if (isOnlyLetters(v.content)) {
            tensor.rankList.push(v.content);
            tensor.rankVariableExpressions[v.content] = "Null";
        }
    }
}

function getRanks(cur_node, tensor) {
    const ranks = getRankExpressions(cur_node.args[0].content);
    const noSuperscript = tensor.rankList.length === 0;

    for (let rankIndex = 0; rankIndex < ranks.length; rankIndex++) {
        const rankExpression = ranks[rankIndex];

        if (noSuperscript) {
            const rankName = String.fromCharCode(77 + rankIndex);
            tensor.rankList.push(rankName);
            tensor.rankVariableExpressions[rankName] = rankExpression;
        } else {
            const rankName = tensor.rankList[rankIndex];
            if (rankName) {
                tensor.rankVariableExpressions[rankName] = rankExpression;
            }
        }
    }
}

function contentToText(content) {
    return (content ?? []).map(nodeToExpressionText).join("");
}

function contentToSymbolText(content) {
    return (content ?? []).map(nodeToSymbolText).join("");
}

function nodeToSymbolText(node) {
    if (!node) {
        return "";
    }

    if (node.type === "whitespace") {
        return "";
    }

    if (node.type === "macro") {
        const args = (node.args ?? [])
            .map(arg => `{${contentToSymbolText(arg.content)}}`)
            .join("");
        return `${node.content}${args}`;
    }

    if (node.type === "group") {
        return contentToSymbolText(node.content);
    }

    return node.content ?? "";
}

function getArgumentText(node) {
    return contentToText(node?.args?.[0]?.content).trim();
}

function normalizeFunctionName(name) {
    return name.replace(/\\_/g, "_");
}

function consumeOptionalLabel(cursor) {
    const node = cursor.peek();
    if (node?.type !== "macro" || node.content !== "^") {
        return 0;
    }

    const labelText = getArgumentText(node);
    if (!isOnlyDigits(labelText)) {
        return 0;
    }

    cursor.advance();
    return Number(labelText);
}

function consumeSymbolText(cursor) {
    const node = cursor.peek();

    if (node?.type === "macro" && node.content === "text") {
        cursor.advance();
        return getArgumentText(node);
    }

    if (
        node?.type === "macro" &&
        ["bar", "mathbb", "mathbbm"].includes(node.content) &&
        cursor.peek(1)?.type === "group"
    ) {
        cursor.advance();
        const group = cursor.advance();
        return `${node.content}{${contentToSymbolText(group.content)}}`;
    }

    if (
        node?.type === "macro" &&
        node.content === "ominus" &&
        cursor.peek(1)?.type === "macro" &&
        cursor.peek(1)?.content === "_"
    ) {
        cursor.advance();
        const subscript = cursor.advance();
        return `ominus_${getArgumentText(subscript)}`;
    }

    if (
        node?.type === "string" &&
        node.content === "t" &&
        cursor.peek(1)?.content === "e" &&
        cursor.peek(2)?.content === "x" &&
        cursor.peek(3)?.content === "t" &&
        cursor.peek(4)?.type === "group"
    ) {
        cursor.advance();
        cursor.advance();
        cursor.advance();
        cursor.advance();
        const group = cursor.advance();
        return contentToText(group.content);
    }

    cursor.advance();
    return nodeToSymbolText(node);
}

function consumeUntilString(cursor, endContent) {
    let text = "";

    while (!cursor.isDone()) {
        const node = cursor.peek();
        if (node?.type === "string" && node.content === endContent) {
            break;
        }

        text += nodeToSymbolText(cursor.advance());
    }

    return normalizeFunctionName(text.trim());
}

function createComputeOp(symbolText) {
    const symbol = BUILTIN_COMPUTE_SYMBOLS[symbolText] ?? BUILTIN_COMPUTE_SYMBOLS[symbolText.trim()];
    if (symbol) {
        return {
            symbol: symbol
        };
    }

    return {
        name: symbolText
    };
}

function createMergeOp(symbolText) {
    const symbol = BUILTIN_MERGE_SYMBOLS[symbolText] ?? BUILTIN_MERGE_SYMBOLS[symbolText.trim()];
    if (symbol) {
        return {
            symbol: symbol
        };
    }

    return {
        name: symbolText
    };
}

function createCoordinateOp(symbolText) {
    const symbol = BUILTIN_MERGE_SYMBOLS[symbolText] ?? BUILTIN_MERGE_SYMBOLS[symbolText.trim()];
    if (symbol) {
        return {
            symbol: symbol
        };
    }

    return {
        name: normalizeFunctionName(symbolText)
    };
}

function consumeComputationSpec(cursor, kind) {
    cursor.advance();
    const label = consumeOptionalLabel(cursor);
    cursor.skipWhitespace();

    const computeSymbol = consumeSymbolText(cursor);
    cursor.skipWhitespace();

    let mergeSymbol = "mathbb{1}";
    if (cursor.peek()?.content === "(") {
        cursor.advance();
        cursor.skipWhitespace();
        mergeSymbol = consumeSymbolText(cursor);
        cursor.skipWhitespace();

        if (cursor.peek()?.content === ")") {
            cursor.advance();
        }
    }

    return {
        label: label,
        compute_op: createComputeOp(computeSymbol),
        merge_op: createMergeOp(mergeSymbol)
    };
}

function consumeRankList(cursor) {
    const rankNode = cursor.peek();
    if (rankNode?.type !== "macro" || rankNode.content !== "_") {
        return [];
    }

    cursor.advance();
    return getRankExpressions(rankNode.args[0].content);
}

function consumePopulateSpec(cursor) {
    cursor.advance();
    const label = consumeOptionalLabel(cursor);
    const rankList = consumeRankList(cursor);
    cursor.skipWhitespace();

    const computeSymbol = consumeSymbolText(cursor);
    cursor.skipWhitespace();

    let coordSymbol = "mathbb{1}";
    if (cursor.peek()?.content === "(") {
        cursor.advance();
        cursor.skipWhitespace();
        coordSymbol = consumeUntilString(cursor, ")");
        cursor.skipWhitespace();

        if (cursor.peek()?.content === ")") {
            cursor.advance();
        }
    }

    return {
        label: label,
        rank_list: rankList,
        compute_op: createComputeOp(computeSymbol),
        coord_op: createCoordinateOp(coordSymbol)
    };
}

function unwrapTopLevelContent(nodes) {
    if (!Array.isArray(nodes)) {
        return [];
    }

    return nodes.flatMap(node => {
        if (node.type === "displaymath" || node.type === "mathenv") {
            return unwrapTopLevelContent(node.content);
        }

        return [node];
    });
}

export function parseExpression(rawContent) {
    rawContent = unwrapTopLevelContent(rawContent);
    const cursor = new Cursor(rawContent);
    let parsedEdgeAst = [];
    let tensor = null;
    let einsum = null;         
    let outputCount = 1;                

    function finishEinsum() {
        if (einsum && tensor) {
            tensor.role = "Output" + outputCount;
            outputCount = 0;
            einsum.tensors.push(tensor);
            parsedEdgeAst.push(einsum);
        }

        einsum = null;
        tensor = null;
    }

    while (!cursor.isDone()) {
        cursor.skipWhitespace();
        if (cursor.isDone()) break;           

        let cur_node = cursor.peek();          

        if (cur_node.type === "string" && isOnlyLetters(cur_node.content)) {
            tensor = createEmptyTensor(cur_node.content);  
            console.log(cur_node.content);
            cursor.advance();
        }
        else if (cur_node.type === "macro" && cur_node.content === "^") {
            getRankVariables(cur_node, tensor);
            cursor.advance();
        }
        else if (cur_node.type === "macro" && cur_node.content === "_") {
            getRanks(cur_node, tensor);
            cursor.advance();
        }
        else if (cur_node.type === "string" && cur_node.content === "=") {
            tensor.role = "Output";
            einsum = createEinsum(tensor.name);
            einsum.tensors.push(tensor);
            cursor.advance();                 
        }
        else if (cur_node.type === "macro" && cur_node.content === "lll") {
            let populate = consumePopulateSpec(cursor);

            if (einsum){
                einsum.populate.push(populate);
            }
        }
        else if (cur_node.type === "macro" && cur_node.content === "\\") {
            finishEinsum();
            outputCount = 1;
            cursor.advance();
        }
        else if (cur_node.type === "macro" && cur_node.content !== "bigwedge" && cur_node.content !== "bigvee") {
            

            if (einsum){
                tensor.role = "Output" + outputCount;
                outputCount++;
                einsum.tensors.push(tensor);
                cursor.advance();
                const label = consumeOptionalLabel(cursor);
                einsum.operator.push({
                    symbol: cur_node.content,
                    label: label
                });
                continue;
            }
            cursor.advance();
        }
        else if (cur_node.type === "macro" && cur_node.content === "bigwedge") {
            let map = consumeComputationSpec(cursor, "map");

            if (einsum){
                einsum.map.push(map);
            }
        }
        else if (cur_node.type === "macro" && cur_node.content === "bigvee") {
            let reduce = consumeComputationSpec(cursor, "reduce");

            if (einsum){
                einsum.reduce.push(reduce);
            }
        }
        else if (cur_node.type === "string" && cur_node.content === "\\") {
            finishEinsum();
            outputCount = 1;
            cursor.advance();
        }
        else {
            
            cursor.advance();
        }
    }

    finishEinsum();

   console.log(JSON.stringify(parsedEdgeAst[0], null, 2));

    return parsedEdgeAst;
}







