#!/usr/bin/env node

import * as fs from "fs";
import { getParser } from "@unified-latex/unified-latex-util-parse";

var input_file = "example4_tester_code.txt";
const content = fs.readFileSync(input_file, "utf8");
console.log("Given LaTeX Expression:\n", content, "\n");

const parser = getParser();
const parsedAst = parser.parse(content.toString());

function createTensor(name, type) {
    return { type, name, rankList: [], rankVariableExpressions: {} };
}

function generateRankList(count) {
    const ranks = [];
    for (let i = 0; i < count; i++) ranks.push(String.fromCharCode(77 + i));
    return ranks;
}

function getLookAheadArgs(content, start) {
    let upperArgs = [], lowerArgs = [];
    let j = start;
    while (j < content.length) {
        if (content[j].type === "whitespace") { j++; continue; }
        if (content[j].type === "macro" && (content[j].content === "^" || content[j].content === "_")) {
            if (content[j].content === "^") upperArgs = content[j].args[0].content;
            else lowerArgs = content[j].args[0].content;
            j++;
        } else break;
    }
    return { upperArgs, lowerArgs, nextIdx: j };
}

function getRanks(tensor, upperArgs, lowerArgs) {
    const upper = upperArgs.filter(n => n.content !== "," && n.type !== "whitespace");
    const lower = lowerArgs.filter(n => n.content !== "," && n.type !== "whitespace");

    if (upper.length == 0) {
        console.warn(`Warning: Rank shape for tensor $${tensor.name}$ not specified`);
        const generated = generateRankList(lower.length);
        for (let k = 0; k < generated.length; k++) {
            tensor.rankList.push(generated[k]);
            tensor.rankVariableExpressions[generated[k]] = lower[k].content;
        }
    } else {
        for (let k = 0; k < upper.length; k++) {
            tensor.rankList.push(upper[k].content);
            tensor.rankVariableExpressions[upper[k].content] = lower[k].content;
        }
    }
}

function formatOperator(node) {
    if (node.type === "macro") return "\\" + node.content;
    return node.content;
}

/*Pretty print in the bullet-point style*/
function printResult(parsedResult) {
    for (const [, tensor] of Object.entries(parsedResult.tensors)) {
        console.log(`* Tensor:`);
        console.log(`   * Type: ${tensor.type}`);
        console.log(`   * Name: "${tensor.name}"`);
        console.log(`   * Rank List: [${tensor.rankList.map(r => `"${r}"`).join(", ")}]`);
        console.log(`   * Rank Variable Expressions:`);
        for (const [rank, variable] of Object.entries(tensor.rankVariableExpressions)) {
            console.log(`      * "${rank}": ${variable}`);
        }
        console.log();
    }

    console.log(`* Operator Between Operands: ${parsedResult.operatorBetweenOperands}`);
    console.log();

    const { map, reduce, populate } = parsedResult.operations;
    console.log(`* Map:`);
    console.log(`   * Merge: ${map.merge}`);
    console.log(`   * Compute: ${map.compute}`);
    console.log(`* Reduce:`);
    console.log(`   * Merge: ${reduce.merge}`);
    console.log(`   * Compute: ${reduce.compute}`);
    console.log(`* Populate:`);
    console.log(`   * Coordinate: ${populate.coordinate}`);
    console.log(`   * Compute: ${populate.compute}`);
}

function processDisplayMathNode(node) {
    const content = node.content || [];
    let equalsEncountered = false;
    let doubleColonEncountered = false;

    const parsedResult = {
        tensors: {},
        operatorBetweenOperands: "Null",
        operations: {
            map:      { merge: "default (pass-through)", compute: "Null" },
            reduce:   { merge: "Null", compute: "Null" },
            populate: { coordinate: "Null", compute: "Null" }
        }
    };

    let operandIdx = 1;

    for (let i = 0; i < content.length; i++) {

        if (content[i].type == "string" && content[i].content == "=") {
            equalsEncountered = true;
        }

        else if (content[i].content == ":") {
            doubleColonEncountered = true;
        }

        /*Capture \times or \cdot between operands as map.compute*/
        else if (equalsEncountered && !doubleColonEncountered && content[i].type === "macro") {
            const op = content[i].content;
            if (op === "times" || op === "cdot") {
                parsedResult.operatorBetweenOperands = "\\" + op;
            }
        }

        else if (content[i].type == "string" && !equalsEncountered && !doubleColonEncountered) {
            let name = content[i].content;
            parsedResult.tensors[name] = createTensor(name, "Output");
            const { upperArgs, lowerArgs, nextIdx } = getLookAheadArgs(content, i + 1);
            getRanks(parsedResult.tensors[name], upperArgs, lowerArgs);
            i = nextIdx - 1;
        }

        else if (content[i].type == "string" && equalsEncountered && !doubleColonEncountered) {
            let name = content[i].content;
            parsedResult.tensors[name] = createTensor(name, "Operand" + operandIdx);
            const { upperArgs, lowerArgs, nextIdx } = getLookAheadArgs(content, i + 1);
            getRanks(parsedResult.tensors[name], upperArgs, lowerArgs);
            i = nextIdx - 1;
            operandIdx++;
        }

        else if (equalsEncountered && doubleColonEncountered && content[i].type === "macro") {
            let section = null;
            if (content[i].content === "bigwedge") section = "map";
            else if (content[i].content === "bigvee") section = "reduce";

            if (section) {
                let j = i + 1;
                while (j < content.length && content[j].type === "whitespace") j++;
                parsedResult.operations[section].compute = formatOperator(content[j]);
                j++;
                while (j < content.length && content[j].type !== "macro") j++;
                if (j < content.length) parsedResult.operations[section].merge = formatOperator(content[j]);
                i = j;
            }
        }
    }

    printResult(parsedResult);
}

if (parsedAst.content && parsedAst.content.length > 0) {
    for (const node of parsedAst.content) {
        if (node.type === "displaymath") {
            processDisplayMathNode(node);
        }
    }
}