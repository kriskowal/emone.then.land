const stride = {
    x: 200,
    y: 162,
};

const ignoreMissingNames = {
    north: true,
    south: true,
    east: true,
    west: true,
    center: true,
    empty: true,
};

// importTemplates walks an SVG DOM and populates a map for every node with an
// Inkscape-assigned label.
// These correspond to layer names in the Inkscape user experience
// and labeled groups in SVG.
// Each of these layers corresponds to a stroke in the emonë script.
export function importTemplates(node, labels) {
    while (node != null) {
        if (node.nodeType === Document.ELEMENT_NODE) {
            let label = node.getAttribute("inkscape:label");
            if (label != null) {
                labels.set(label, node);
            }
            importTemplates(node.firstChild, labels);
        }
        node = node.nextSibling;
    }
}

// render overwrites and resizes an SVG element so that the
// view contains all of the modeled strokes.
export function render(element, model, templates, size) {
    element.innerHTML = "";

    for (const {x, y, ...glyphs} of model.glyphs) {
        for (const stroke of Object.keys(glyphs)) {
            let template = templates.get(stroke);
            if (template == null) {
                if (!ignoreMissingNames[stroke]) {
                    console.warn('missing stroke', stroke);
                }
            } else {
                let node = document.importNode(template, true);
                node.setAttribute("transform", `translate(${x*stride.x}, ${y*stride.y})`);
                element.appendChild(node);
            }
        }
    }

    let actual = {
        x: 500 + (model.size.x-1)*stride.x,
        y: 500 + (model.size.y-1)*stride.y,
    };
    let scale = 1;

    element.setAttribute('height', actual.y);
    element.setAttribute('width', actual.x);

    if (actual.x > size.x) {
        scale *= size.x / actual.x;
        actual = resize(actual, size.x / actual.x);
    }

    if (actual.y > size.y) {
        scale *= size.y / actual.y;
        actual = resize(actual, size.y / actual.y);
    }

    element.style.transformOrigin = '0 0';
    element.style.transform = `scale(${scale})`;
}

function resize(size, scale) {
    return {x: size.x*scale, y: size.y*scale};
}
