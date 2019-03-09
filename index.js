import {render, importTemplates} from './render.js';
import {transcribe} from './transcribe.js';

(async () => {
    let res = await fetch("emone.svg");
    let text = await res.text();
    let parser = new DOMParser();
    let doc = parser.parseFromString(text, "application/xml");
    let templates = new Map();
    importTemplates(doc.documentElement, templates);

    const renderElement = document.querySelector("#render");
    const textElement = document.querySelector("#text");
    let model;
    let size;

    function measure() {
        size = {
            x: window.innerWidth,
            y: window.innerHeight - textElement.innerHeight,
        };
    }

    function change() {
        console.clear();
        model = transcribe(textElement.innerText.trim().toLowerCase());
    }

    function draw() {
        render(renderElement, model, templates, size);
    };

    textElement.addEventListener('keyup', () => {
        change();
        draw();
    });

    window.addEventListener('resize', () => {
        measure();
        draw();
    });

    change();
    measure();
    draw();

    let range = document.createRange();
    range.selectNodeContents(textElement);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

})();
