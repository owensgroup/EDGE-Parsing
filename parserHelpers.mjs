/*
parserHelpers.mjs - Helper file for EDGE parsing

This file has a class called Cursor which is used to index throught the raw parsed data from Unified Parser. 
It also contains a bunch of helper functions for EDGE parsing that may be reused in the future. 
*/


const isOnlyLetters = (str) => str && /^[a-z]+$/i.test(str);

class Cursor {
    constructor(nodes) {
        this.nodes = nodes;
        this.pos = 0;
    }

    peek() {
        return this.nodes[this.pos];
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
    const ranks = cur_node.args[0].content;
    const noSuperscript = tensor.rankList.length === 0;
    let rankIndex = 0;

    for (const v of ranks) {
        if (isOnlyLetters(v.content)) {
            if (noSuperscript) {
                const rankName = String.fromCharCode(77 + rankIndex);
                tensor.rankList.push(rankName);
                tensor.rankVariableExpressions[rankName] = v.content;
            } else {
                const rankName = tensor.rankList[rankIndex];
                tensor.rankVariableExpressions[rankName] = v.content;
            }
            rankIndex++;
        }
    }
}

export function parseExpression(rawContent) {
    const cursor = new Cursor(rawContent);
    let parsedEdgeAst = [];
    let tensor = null;
    let einsum = null;         
    let outputCount = 1;                

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
        else if (cur_node.type === "macro" && cur_node.content !== "bigwedge" && cur_node.content !== "bigvee") {
            

            if (einsum){
                tensor.role = "Output" + outputCount;
                outputCount++;
                einsum.tensors.push(tensor);
                einsum.operator.push(cur_node.content);
            }
            cursor.advance();
        }
        else if (cur_node.type === "macro" && cur_node.content === "bigwedge") {
            
            cursor.advance();
            cursor.skipWhitespace();
            let merge = cursor.peek().content;
            cursor.advance();
            cursor.advance();
            let compute = cursor.advance().content;


            let map = {
                merge: merge,
                compute: compute
            };

            if (einsum){
                einsum.map.push(map);
            }
            cursor.advance();
        }
        else if (cur_node.type === "macro" && cur_node.content === "bigvee") {
            
            cursor.advance();
            cursor.skipWhitespace();
            let merge = cursor.peek().content;
            cursor.advance();
            cursor.advance();
            let compute = cursor.advance().content;

            
            let reduce = {
                merge: merge,
                compute: compute
            };

            if (einsum){
                einsum.reduce.push(reduce);
            }
            cursor.advance();
        }
        else if (cur_node.type === "string" && cur_node.content === "\\") {
            
            if (einsum){
                tensor.role = "Output" + outputCount;
                outputCount = 0;
                einsum.tensors.push(tensor);
                parsedEdgeAst.push(einsum);
            }
            einsum = null;
            tensor = null;
            cursor.advance();
        }
        else {
            
            cursor.advance();
        }
    }

    if (einsum){
        tensor.role = "Output" + outputCount;
        outputCount = 0;
        einsum.tensors.push(tensor);
        parsedEdgeAst.push(einsum);
    }

    console.log(parsedEdgeAst[0]);

    return parsedEdgeAst;
}







