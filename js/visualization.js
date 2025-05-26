export function automatonToDot(automaton, title) {
    let dot = `digraph "${title}" {\n`;
    dot += `  rankdir=LR;\n  node [shape=circle, style=filled, fillcolor=lightblue];\n`;
    for (let i = 0; i < automaton.states; i++) {
        const shape = automaton.accepting.has(i) ? 'doublecircle' : 'circle';
        const label = `q${i}${i === automaton.start ? '\\n(start)' : ''}${automaton.accepting.has(i) ? '\\n(accepting)' : ''}`;
        dot += `  q${i} [shape=${shape}, label="${label}", fillcolor=lightblue];\n`; // Changed: All states lightblue
    }
    for (let from = 0; from < automaton.states; from++) {
        if (automaton.edges[from]) {
            for (let symbol in automaton.edges[from]) {
                const label = symbol === '0' ? 'ε' : symbol;
                automaton.edges[from][symbol].forEach(to => {
                    dot += `  q${from} -> q${to} [label="${label}"];\n`;
                });
            }
        }
    }
    dot += `}`;
    return dot;
}

export function parseTreeToDot(tree, nodeId = 'n0') {
    let dot = `digraph ParseTree {\n`;
    dot += `  rankdir=TB;\n  node [shape=box, style=filled, fillcolor=lightyellow];\n`;
    let nodeCounter = [0];

    function traverse(node, parentId) {
        const currentId = `n${nodeCounter[0]++}`;
        const label = node.type === 'letter' ? `"${node.value}"` :
                      node.type === 'lambda' ? '"λ"' :
                      `"${node.type}"`;
        dot += `  ${currentId} [label=${label}];\n`;
        if (parentId) {
            dot += `  ${parentId} -> ${currentId};\n`;
        }
        if (node.value && typeof node.value === 'object') {
            if (Array.isArray(node.value)) {
                node.value.forEach(child => traverse(child, currentId));
            } else {
                traverse(node.value, currentId);
            }
        }
        return currentId;
    }

    traverse(tree, null);
    dot += `}`;
    return dot;
}

export async function visualizeParseTree(tree, containerId) {
    const dot = parseTreeToDot(tree);
    const viz = new Viz();
    try {
        const svgElement = await viz.renderSVGElement(dot, { engine: 'dot' });
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        container.appendChild(svgElement);
    } catch (error) {
        console.error('Error rendering parse tree:', error);
        document.getElementById(containerId).innerText = 'Error rendering parse tree';
    }
}

export async function visualizeAutomaton(automaton, containerId, title) {
    const dot = automatonToDot(automaton, title);
    const viz = new Viz();
    try {
        const svgElement = await viz.renderSVGElement(dot, { engine: 'dot' });
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        container.appendChild(svgElement);
        svgElement.querySelectorAll('g.node').forEach(node => {
            const stateId = node.querySelector('title').textContent.match(/q(\d+)/)[1];
            node.id = `state-q${stateId}-${containerId}`;
        });
        svgElement.querySelectorAll('g.edge').forEach(edge => {
            const [from, to] = edge.querySelector('title').textContent.split('->').map(s => s.match(/q(\d+)/)[1]);
            const label = edge.querySelector('text').textContent;
            edge.id = `edge-q${from}-q${to}-${label.replace('ε', '0')}-${containerId}`;
        });
    } catch (error) {
        console.error('Error rendering SVG:', error);
        document.getElementById(containerId).innerText = 'Error rendering automaton';
    }
}

import { generateAutomata } from './automata.js';