import { generateAutomata } from './automata.js';
import { visualizeAutomaton, visualizeParseTree } from './visualization.js';

window.generateAndVisualize = async () => {
    const regex = document.getElementById('regex').value;
    const errorDiv = document.getElementById('error');
    errorDiv.innerText = '';
    const automata = generateAutomata(regex);
    if (automata.error) {
        errorDiv.innerText = `Error: ${automata.error}`;
        document.getElementById('parse-tree-svg').innerText = '';
        document.getElementById('nfal-svg').innerText = '';
        document.getElementById('nfa-svg').innerText = '';
        document.getElementById('dfa-svg').innerText = '';
        document.getElementById('dfam-svg').innerText = '';
        return;
    }
    await Promise.all([
        visualizeParseTree(automata.parseTree, 'parse-tree-svg'),
        visualizeAutomaton(automata.NFAl, 'nfal-svg', 'NFAl'),
        visualizeAutomaton(automata.NFA, 'nfa-svg', 'NFA'),
        visualizeAutomaton(automata.DFA, 'dfa-svg', 'DFA'),
        visualizeAutomaton(automata.DFAm, 'dfam-svg', 'DFAm')
    ]);
    errorDiv.innerText = 'Automata generated successfully!';
};
document.addEventListener("DOMContentLoaded", () => {
    const infoCard = document.getElementById("info-card");
    const infoTitle = document.getElementById("info-title");
    const infoText = document.getElementById("info-text");
    const select = document.getElementById("visualizationType");

    const descriptions = {
        all: {
            title: "All Visualizations",
            text: "Displays the full pipeline: Parse Tree (AST), NFAl (NFA with Lambda), NFA (without Lambda), DFA, and minimized DFA."
        },
        ast: {
            title: "Parse Tree (AST)",
            text: "A parse tree is a tree structure that shows how a regular expression is built. It breaks the regex into its components like literals, operators, and groups, helping you understand the structure and order of operations."
        },
        nfal: {
            title: "NFAl (NFA with Lambda)",
            text: "NFAl stands for Nondeterministic Finite Automaton with lambda (ε) transitions. These are special transitions that allow the automaton to change states without reading any input. It's typically the first automaton generated from a regular expression."
        },
        nfa: {
            title: "NFA (No Lambda)",
            text: "This is a cleaner version of NFAl where all the ε-transitions are removed. It's still nondeterministic, meaning it can have multiple possible next states for the same input, but it's easier to simulate and prepare for conversion to DFA."
        },
        dfa: {
            title: "DFA (Deterministic Finite Automaton)",
            text: "A DFA has exactly one possible transition per input symbol in each state. It doesn’t use ε-transitions and removes all ambiguity, making it ideal for fast pattern matching. It's created from an NFA using a method called subset construction."
        },
        dfam: {
            title: "DFAm (Minimized DFA)",
            text: "DFAm is an optimized version of a DFA with the minimum number of states. It merges equivalent states to make the automaton more efficient. This form is best for real-world applications where speed and resource use matter."
        }
    };

    select.addEventListener("change", () => {
        const selected = select.value;
        if (descriptions[selected]) {
            infoCard.style.display = "block";
            infoTitle.textContent = descriptions[selected].title;
            infoText.textContent = descriptions[selected].text;
        } else {
            infoCard.style.display = "none";
        }
    });

    select.dispatchEvent(new Event('change'));
});

const regexTips = [
    "Avoid using '.*' inside large groups — it can be very slow.",
    "Use character classes like [a-z] instead of (a|b|c|...) when possible.",
    "Prefer + or {1,} over * if the input must exist.",
    "Anchors (^ and $) can make matching faster.",
    "Avoid nested quantifiers like (a+)+ — they are prone to backtracking.",
    "Precompile regex if reused frequently in performance-critical code.",
    "Use non-capturing groups (?:...) if you don’t need the match."
];

function populateRegexTips() {
    const tipsList = document.getElementById("tips-list");
    tipsList.innerHTML = "";
    regexTips.forEach(tip => {
        const li = document.createElement("li");
        li.textContent = tip;
        tipsList.appendChild(li);
    });
}

window.addEventListener("DOMContentLoaded", populateRegexTips);
