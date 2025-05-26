
function addTransition(FA, from, to, symbol) {
    FA.edges[from] = FA.edges[from] || {};
    FA.edges[from][symbol] = FA.edges[from][symbol] || new Set();
    if (FA.edges[from][symbol].has(to)) return false;
    FA.edges[from][symbol].add(to);
    FA.outgoing[from] = (FA.outgoing[from] || 0) + 1;
    FA.incoming[to] = (FA.incoming[to] || 0) + 1;
    return true;
}

function removeTransition(FA, from, to, symbol) {
    if (FA.edges[from]?.[symbol]?.has(to)) {
        FA.outgoing[from]--;
        FA.incoming[to]--;
        FA.edges[from][symbol].delete(to);
    }
}

function removeState(FA, state) {
    if (FA.edges[state]) {
        for (let symbol in FA.edges[state]) {
            FA.edges[state][symbol].forEach(val => removeTransition(FA, state, val, symbol));
        }
    }
    for (let i = 0; i < FA.states; i++) {
        if (!FA.edges[i]) continue;
        for (let symbol in FA.edges[i]) {
            FA.edges[i][symbol].forEach(val => {
                if (val === state) removeTransition(FA, i, state, symbol);
            });
            const newSet = new Set([...FA.edges[i][symbol]].map(val => val >= state ? val - 1 : val));
            FA.edges[i][symbol] = newSet;
        }
    }
    if (FA.start >= state) FA.start--;
    FA.accepting = new Set([...FA.accepting].map(val => val >= state ? val - 1 : val));
    for (let i = state; i < FA.states; i++) {
        FA.edges[i] = FA.edges[i + 1];
        FA.outgoing[i] = FA.outgoing[i + 1];
        FA.incoming[i] = FA.incoming[i + 1];
    }
    FA.states--;
}

function deepCopyAutomaton(FA) {
    return {
        alphabet: new Set(FA.alphabet),
        states: FA.states,
        start: FA.start,
        edges: FA.edges.map(edge => edge ? Object.fromEntries(Object.entries(edge).map(([k, v]) => [k, new Set(v)])) : undefined),
        outgoing: [...FA.outgoing],
        incoming: [...FA.incoming],
        accepting: new Set(FA.accepting)
    };
}

function ArrayHasArray(array, sub) {
    return array.findIndex(arr => arr.length === sub.length && arr.every((v, i) => v === sub[i]));
}

function parseRegex(stringo) {
    const stream = {
        string: stringo,
        pos: 0,
        cur() { return this.string[this.pos]; },
        done() { return this.pos === this.string.length; }
    };
    try {
        const tree = parseExpr(stream);
        if (!stream.done()) throw new Error(`Unexpected character at position ${stream.pos}: ${stream.cur()}`);
        return tree;
    } catch (err) {
        return { error: err.message || "Invalid regex syntax" };
    }
}

function parseExpr(stream) {
    const terms = [parseTerm(stream)];
    while (!stream.done() && stream.cur() === '|') {
        stream.pos++;
        if (stream.done()) throw new Error("Missing term after '|'");
        terms.push(parseTerm(stream));
    }
    return terms.length === 1 ? terms[0] : { type: "or", value: terms };
}

function parseTerm(stream) {
    const concats = [];
    while (!stream.done() && !['|', ')'].includes(stream.cur())) {
        const concat = parseConcat(stream);
        if (concat) {
            if (Array.isArray(concat)) concats.push(...concat);
            else concats.push(concat);
        } else break;
    }
    return concats.length === 0 ? null : concats.length === 1 ? concats[0] : { type: "concat", value: concats };
}

function parseConcat(stream) {
    const atom = parseAtom(stream);
    if (!atom) return null;
    if (!stream.done() && stream.cur() === '*') {
        stream.pos++;
        return { type: "star", value: atom };
    } else if (!stream.done() && stream.cur() === '+') {
        stream.pos++;
        return [atom, { type: "star", value: atom }];
    } else if (!stream.done() && stream.cur() === '?') {
        stream.pos++;
        return { type: "or", value: [atom, { type: "lambda", value: undefined }] };
    }
    return atom;
}

function parseAtom(stream) {
    if (stream.done()) return null;
    if (/[a-zA-Z0-9]/.test(stream.cur())) {
        stream.pos++;
        return { type: "letter", value: stream.string[stream.pos - 1] };
    } else if (stream.cur() === '(') {
        stream.pos++;
        if (stream.done()) throw new Error("Missing expression after '('");
        const expr = parseExpr(stream);
        if (!stream.done() && stream.cur() === ')') {
            stream.pos++;
            return expr;
        }
        throw new Error(`Missing closing parenthesis at position ${stream.pos}`);
    } else if (stream.cur() === '[') {
        if (stream.string.slice(stream.pos, stream.pos + 5) === '[0-9]') {
            stream.pos += 5;
            return {
                type: "or",
                value: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => ({ type: "letter", value: d }))
            };
        } else if (stream.string.slice(stream.pos, stream.pos + 5) === '[a-z]') {
            stream.pos += 5;
            return {
                type: "or",
                value: 'abcdefghijklmnopqrstuvwxyz'.split('').map(c => ({ type: "letter", value: c }))
            };
        } else if (stream.string.slice(stream.pos, stream.pos + 5) === '[A-Z]') {
            stream.pos += 5;
            return {
                type: "or",
                value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => ({ type: "letter", value: c }))
            };
        }
        throw new Error(`Unsupported character class at position ${stream.pos}`);
    }
    throw new Error(`Invalid character at position ${stream.pos}: ${stream.cur()}`);
}

function constructNFAl(tree) {
    const NFAl = { alphabet: new Set(), states: 0, start: 0, edges: [], outgoing: [], incoming: [], accepting: new Set() };
    switch (tree.type) {
        case "or":
            NFAl.states++;
            const oldaccepting = new Set();
            for (const subtree of tree.value) {
                const NFAltemp = constructNFAl(subtree);
                NFAl.alphabet = new Set([...NFAl.alphabet, ...NFAltemp.alphabet]);
                mergeEdges(NFAl, NFAltemp);
                addTransition(NFAl, 0, NFAltemp.start + NFAl.states, "0");
                oldaccepting.add(NFAltemp.accepting.values().next().value + NFAl.states);
                NFAl.states += NFAltemp.states;
            }
            NFAl.states++;
            oldaccepting.forEach(val => addTransition(NFAl, val, NFAl.states - 1, "0"));
            NFAl.accepting.add(NFAl.states - 1);
            return NFAl;
        case "concat":
            let prev;
            for (let i = 0; i < tree.value.length; i++) {
                const NFAltemp = constructNFAl(tree.value[i]);
                NFAl.alphabet = new Set([...NFAl.alphabet, ...NFAltemp.alphabet]);
                mergeEdges(NFAl, NFAltemp);
                if (i === 0) NFAl.start = NFAltemp.start;
                else addTransition(NFAl, prev, NFAltemp.start + NFAl.states, "0");
                if (i === tree.value.length - 1) NFAl.accepting.add(NFAltemp.accepting.values().next().value + NFAl.states);
                prev = NFAltemp.accepting.values().next().value + NFAl.states;
                NFAl.states += NFAltemp.states;
            }
            return NFAl;
        case "star":
            const NFAltemp = constructNFAl(tree.value);
            addTransition(NFAltemp, NFAltemp.states, NFAltemp.start, "0");
            addTransition(NFAltemp, NFAltemp.accepting.values().next().value, NFAltemp.states, "0");
            NFAltemp.states++;
            NFAltemp.accepting = new Set([NFAltemp.states - 1]);
            NFAltemp.start = NFAltemp.states - 1;
            return NFAltemp;
        case "letter":
            NFAl.alphabet.add(tree.value);
            NFAl.states = 2;
            addTransition(NFAl, 0, 1, tree.value);
            NFAl.accepting.add(1);
            return NFAl;
        case "lambda":
            NFAl.states = 1;
            NFAl.accepting.add(0);
            return NFAl;
        default:
            console.error("Unknown type");
    }
}

function mergeEdges(orig, temp) {
    for (let i = 0; i < temp.states; i++) {
        if (temp.edges[i]) {
            for (let symbol in temp.edges[i]) {
                temp.edges[i][symbol].forEach(value => addTransition(orig, i + orig.states, value + orig.states, symbol));
            }
        }
    }
}

function trivialStates(NFAl) {
    for (let i = NFAl.states - 1; i >= 0; i--) {
        let removed = false;
        if (NFAl.outgoing[i] === 1) {
            for (let symbol in NFAl.edges[i]) {
                if (symbol === "0" && !NFAl.edges[i][symbol].has(i) && NFAl.edges[i][symbol]?.size) {
                    removeTrivialState(NFAl, i, NFAl.edges[i][symbol].values().next().value, false);
                    removed = true;
                    break;
                }
            }
        }
        if (NFAl.incoming[i] === 1 && !removed) {
            for (let j = 0; j < NFAl.states; j++) {
                if (NFAl.edges[j]?.["0"]) {
                    for (let val of NFAl.edges[j]["0"]) {
                        if (val === i) {
                            removeTrivialState(NFAl, i, j, true);
                            removed = true;
                            break;
                        }
                    }
                }
                if (removed) break;
            }
        }
    }
    return NFAl;
}

function removeTrivialState(NFAl, state, tofr, tag) {
    if (NFAl.accepting.has(state) || NFAl.start === state) return;
    if (!tag) {
        for (let i = 0; i < NFAl.states; i++) {
            for (let symbol in NFAl.edges[i]) {
                NFAl.edges[i][symbol].forEach(value => {
                    if (value === state) {
                        addTransition(NFAl, i, tofr, symbol);
                        removeTransition(NFAl, i, state, symbol);
                    }
                });
            }
        }
        removeTransition(NFAl, state, tofr, "0");
    } else {
        for (let symbol in NFAl.edges[state]) {
            NFAl.edges[state][symbol].forEach(value => {
                addTransition(NFAl, tofr, value, symbol);
                removeTransition(NFAl, state, value, symbol);
            });
        }
        removeTransition(NFAl, tofr, state, "0");
    }
    removeState(NFAl, state);
}

function removelTransitions(NFAl) {
    const closure = lClosure(NFAl);
    NFAl.ledges = new Set();
    NFAl.newedges = new Set();
    NFAl.normaledges = new Set();
    NFAl.newaccepting = [];
    for (let i = 0; i < NFAl.states; i++) {
        if (NFAl.edges[i]) {
            for (let symbol in NFAl.edges[i]) {
                NFAl.edges[i][symbol].forEach(val => {
                    (symbol !== "0" ? NFAl.normaledges : NFAl.ledges).add([i, val, symbol]);
                });
            }
        }
    }
    for (let i = 0; i < NFAl.states; i++) {
        closure[i].forEach(val => {
            if (NFAl.edges[val]) {
                for (let symbol in NFAl.edges[val]) {
                    if (symbol !== "0" && NFAl.edges[val][symbol]) {
                        NFAl.edges[val][symbol].forEach(val2 => {
                            if (!NFAl.edges[i]?.[symbol]?.has(val2)) {
                                if (addTransition(NFAl, i, val2, symbol)) NFAl.newedges.add([i, val2, symbol]);
                            }
                        });
                    }
                }
            }
            if (NFAl.accepting.has(val) && !NFAl.accepting.has(i)) {
                NFAl.accepting.add(i);
                NFAl.newaccepting.push(i);
            }
        });
    }
    for (let i = 0; i < NFAl.states; i++) {
        if (NFAl.edges[i]?.["0"]) {
            NFAl.edges[i]["0"].forEach(val => removeTransition(NFAl, i, val, "0"));
        }
    }
    return NFAl;
}

function lClosure(NFAl) {
    const closure = [];
    for (let i = NFAl.states - 1; i >= 0; i--) {
        closure[i] = new Set([i]);
        closure[i].forEach(val => {
            if (NFAl.edges[val]?.["0"]) {
                NFAl.edges[val]["0"].forEach(val2 => {
                    if (val2 > i) closure[val2].forEach(val3 => closure[i].add(val3));
                    else closure[i].add(val2);
                });
            }
        });
    }
    return closure;
}

function removeUnreachable(NFA, NFAold) {
    const reachable = new Set([NFA.start]);
    NFAold.unreachable = [];
    reachable.forEach(val => {
        if (NFA.edges[val]) {
            for (let symbol in NFA.edges[val]) {
                NFA.edges[val][symbol].forEach(val2 => reachable.add(val2));
            }
        }
    });
    for (let i = NFA.states - 1; i >= 0; i--) {
        if (!reachable.has(i)) {
            removeState(NFA, i);
            NFAold.unreachable.push(i);
        }
    }
    return NFA;
}

function subsetConstruction(NFA) {
    const DFA = {
        alphabet: new Set(NFA.alphabet),
        states: 1,
        start: 0,
        edges: [],
        outgoing: [],
        incoming: [],
        accepting: new Set(),
        statescor: [[NFA.start]]
    };
    if (NFA.accepting.has(NFA.start)) DFA.accepting.add(0);
    for (let i = 0; i < DFA.states; i++) {
        DFA.alphabet.forEach(symbol => {
            const reachable = [];
            DFA.statescor[i].forEach(j => {
                if (NFA.edges[j]?.[symbol]) {
                    NFA.edges[j][symbol].forEach(val => {
                        if (!reachable.includes(val)) reachable.push(val);
                    });
                }
            });
            reachable.sort((a, b) => a - b);
            const index = ArrayHasArray(DFA.statescor, reachable);
            if (index !== -1) {
                addTransition(DFA, i, index, symbol);
            } else {
                if (reachable.some(j => NFA.accepting.has(j))) DFA.accepting.add(DFA.states);
                addTransition(DFA, i, DFA.states, symbol);
                DFA.statescor[DFA.states] = reachable;
                DFA.states++;
            }
        });
    }
    return DFA;
}

function minimizeDFA(DFA) {
    const equivalent = Array(DFA.states).fill().map(() => []);
    for (let i = 0; i < DFA.states; i++) {
        for (let j = i; j < DFA.states; j++) {
            equivalent[i][j] = (DFA.accepting.has(i) && DFA.accepting.has(j)) || (!DFA.accepting.has(i) && !DFA.accepting.has(j));
        }
    }
    while (true) {
        let marked = false;
        for (let i = 0; i < DFA.states; i++) {
            for (let j = i + 1; j < DFA.states; j++) {
                if (equivalent[i][j]) {
                    DFA.alphabet.forEach(symbol => {
                        if (!equivalent[i][j]) return;
                        const a = DFA.edges[i][symbol].values().next().value;
                        const b = DFA.edges[j][symbol].values().next().value;
                        if (!equivalent[Math.min(a, b)][Math.max(a, b)]) {
                            equivalent[i][j] = false;
                            marked = true;
                        }
                    });
                }
            }
        }
        if (!marked) break;
    }
    const DFAm = {
        alphabet: new Set(DFA.alphabet),
        states: 0,
        edges: [],
        outgoing: [],
        incoming: [],
        accepting: new Set(),
        statescor: []
    };
    const taken = [];
    for (let i = 0; i < DFA.states; i++) {
        if (taken.includes(i)) continue;
        if (DFA.accepting.has(i)) DFAm.accepting.add(DFAm.states);
        DFAm.statescor[DFAm.states] = [];
        for (let j = i; j < DFA.states; j++) {
            if (equivalent[i][j]) {
                DFAm.statescor[DFAm.states].push(j);
                taken.push(j);
            }
        }
        if (DFAm.statescor[DFAm.states].includes(DFA.start)) DFAm.start = DFAm.states;
        DFAm.states++;
    }
    for (let i = 0; i < DFAm.states; i++) {
        DFAm.alphabet.forEach(symbol => {
            const toOld = DFA.edges[DFAm.statescor[i][0]][symbol].values().next().value;
            const toNew = DFAm.statescor.findIndex(states => states.includes(toOld));
            addTransition(DFAm, i, toNew, symbol);
        });
    }
    return DFAm;
}

// Main function
export function generateAutomata(regex) {
    const parseResult = parseRegex(regex);
    if (parseResult.error) return { error: parseResult.error };
    const NFAl = trivialStates(constructNFAl(parseResult));
    const NFATransition = removelTransitions(deepCopyAutomaton(NFAl));
    const NFA = removeUnreachable(deepCopyAutomaton(NFATransition), NFATransition);
    const DFA = subsetConstruction(NFA);
    const DFAm = minimizeDFA(DFA);
    return { NFAl, NFA, DFA, DFAm, parseTree: parseResult };
}