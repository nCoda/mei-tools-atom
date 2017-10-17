'use babel';

import * as Verovio from 'verovio';
import $ from 'jquery';

export default class MeiToolsAtomView {

  constructor() {
    const initialScale = 45;
    this.createHTMLElements(initialScale);

    // Create Verovio toolkit
    this.vrvToolkit = new Verovio.toolkit();

    // Create options object with default options
    this.vrvOptions = {
      inputFormat: 'mei',
      border: 0,
      adjustPageHeight: 1,
      ignoreLayout: 1,
      noLayout: 1,
      scale: initialScale,
      pageWidth: 100, // has no effect with noLayout enabled
      pageHeight: 60000, // has no effect with noLayout enabled
    };

    // observe active pane, display content accordingly
    this.subscriptions = atom.workspace.getCenter().observeActivePaneItem(item => {
      if (!atom.workspace.isTextEditor(item)) {
        this.verovioSVG.innerHTML = "<h2>Open an MEI file to see it rendered here as music notation.</h2>";
        this.toggleHideForm();
        return;
      }

      let path;
      try {
        path = item.getPath();
      } catch (e) {
        console.log(e);
        this.toggleHideForm();
        return;
      }

      if (path.slice((path.lastIndexOf(".") - 1 >>> 0) + 2) !== "mei") {
        this.verovioSVG.innerHTML = "<h2>This is not an MEI file. Notation will only be rendered for files ending in .mei that contain valid MEI markup.</h2>";
        this.toggleHideForm();
        return;
      }

      // ensure that form controls are enabled
      this.toggleHideForm(false);

      // set Verovio options to defaults, initial render
      this.setOptionsRenderData(item);


      // Listeners

      // when window is resized, if wrapping is enabled, reflow measures
      // TODO: also reflow when pane is resized (observe attributes of parent
      // .atom-dock-content-wrapper)
      $(window).resize(() => {
        if (this.layoutCtrl.checked) {
          this.setOptionsRenderData(item);
        }
      });

      // when zoom level is changed, update options and re-render notation
      this.zoomCtrl.addEventListener('change', () => {
        this.setOptionsRenderData(item, { scale: parseInt(this.zoomCtrl.value) });
      });

      // when vertical scroll (wrap systems) is enabled or disabled, update options and re-render
      // notation
      this.layoutCtrl.addEventListener('change', () => {
        const layoutOrientation = this.layoutCtrl.checked ? 0 : 1;
        this.setOptionsRenderData(item, { noLayout: layoutOrientation });
      });

      // when highlight color is changed, add/update css in head of document
      this.hlghtCtrl.addEventListener('change', () => {
        this.changeHighlightColor(this.hlghtCtrl.value)
      });

      // update when changes occur in MEI code
      item.onDidStopChanging(() => {
        this.updateNotation(item);
      });

      // when cursor is moved, highlight notation that matches element at new cursor position
      item.onDidChangeCursorPosition(() => {
        this.updateHighlight(item);
      });
    });
  }

  updateNotation(textEditor) {
    this.renderVerovio(textEditor.getText());
    this.addNotationEventListeners(textEditor);
    this.updateHighlight(textEditor);
  }

  setOptionsRenderData(textEditor, newOptions = {}) {
    let svgTarget = $(`#${this.verovioSVG.id}`);

    if (svgTarget.length > 0) {

      // overwrite existing options if new ones are passed in
      for (let key in newOptions) {
        this.vrvOptions[key] = newOptions[key];
      }

      // recalculate width based on parent width and scale
      this.vrvOptions.pageWidth = svgTarget.width() * (100 / this.vrvOptions.scale);

      this.vrvToolkit.setOptions(this.vrvOptions);

      this.updateNotation(textEditor);

    } else {
      // if target element not found, set timeout and retry
      setTimeout(() => {
        this.setOptionsRenderData(textEditor, newOptions);
      }, 500);
    }
  }

  updateHighlight(textEditor) {
    let id = this.getIdOfItemAtCursor(textEditor.getBuffer(), textEditor.getCursorBufferPosition());

    // clear existing highlighted classes
    $('g.highlighted').removeClass('highlighted');

    // if matching g element found, add highlighted class
    if (id) {
      $('g#' + id).addClass('highlighted');
    }
  }

  changeHighlightColor(color) {
    this.customStyle.innerHTML = `.mei-tools-atom #verovio-svg g.highlighted, 
                                  .mei-tools-atom #verovio-svg g.highlighted, 
                                  .mei-tools-atom #verovio-svg g.highlighted, 
                                  .mei-tools-atom #verovio-svg g.highlighted * { 
                                    fill: ${color}; 
                                    color: ${color}; 
                                    stroke: ${color};
                                  }`;
  }

  toggleHideForm(hide = true) {
    const el = $(`#${this.controlsForm.id}`);
    if (hide) {
      el.addClass('hidden');
    } else {
      el.removeClass('hidden');
    }
  }

  renderVerovio(data) {
    let output;

    try {
      output = this.vrvToolkit.renderData(data, {});
    } catch (e) {
      console.log(e);
      output = `<h2>There was a problem rendering your MEI. Your markup may contain errors or it may be incompatible with Verovio.</h2>`;
    }

    this.verovioSVG.innerHTML = output;
  }

  addNotationEventListeners(textEditor) {
    let elements = $(`#${this.verovioSVG.id}`).find('g');
    if (elements.length !== 0) {
      elements.bind('mouseup', (el) => {
        this.handleClickOnNotation(el, textEditor);
      });
    }
    else {
      setTimeout(() => {
        this.addNotationEventListeners(textEditor);
      }, 50);
    }
  }

  handleClickOnNotation(e, textEditor) {
    e.stopImmediatePropagation();
    const itemId = e.currentTarget.id;

    const buffer = textEditor.getBuffer();

    // find item by id in buffer
    const re = new RegExp(`(?:xml:id="${itemId}")`);
    let range;
    buffer.scan(re, (obj) => {
      range = obj.range;
      obj.stop();
    });

    // set cursor position in buffer
    if (range) {
      textEditor.setCursorBufferPosition([range.start.row, range.start.column]);
    }
  }

  getIdOfItemAtCursor(text, cursorPosition) {
    let result;
    let tag;
    let row = cursorPosition.row;
    let column = cursorPosition.column;
    const closingTagRe = /(?:<[/])(\S+?)(?:[>])/;
    const XMLidRe = /(?:xml:id=)(?:['"])(\S+?)(?:['"])/;

    // get line from current cursor position
    let line = text.lineForRow(row);

    // check if cursor is on a closing tag by stepping backwards through the characters
    for (let j = column; j > 0; j--) {
      if (line[j] === "/" && line[j - 1] === "<") {
        // if closing tag is found, find the name of the tag with regex
        tag = line.slice(j - 1).match(closingTagRe);
        if (tag && Array.isArray(tag)) {
          tag = tag[1];
          break;
        }
      }
    }

    // if closing tag identified, find opening tag and set row number accordingly
    if (tag) {
      for (let k = row - 1; k >= 0; k--) {
        if (text.lineForRow(k).includes(`<${tag}`)) {
          row = k;
          break;
        }
      }
    }

    // search for xml:id in row
    result = text.lineForRow(row).match(XMLidRe);

    // if one is found, return it
    if (result !== null) {
      return result[1];
    }

    // if no id is found, look in parent staff and measure to find one
    let outsideParentStaff = false;

    for (let m = row; m >= 0; m--) {
      line = text.lineForRow(m);

      if (line.includes('<music')) {
        break;
      }

      if (line.includes('</staff')) {
        outsideParentStaff = true;
        continue;
      }

      if (line.includes('<measure') || (line.includes('<staff') && !outsideParentStaff)) {

        result = line.match(XMLidRe);
        if (result !== null) {
          return result[1];
        }

        // if this line is parent <measure>, stop looking
        if (line.includes('<measure')) {
          break;
        }
      }
    }

    // if no xml:id is found, return null
    return null;
  }

  createHTMLElements(scale) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('mei-tools-atom');

    // Create control form
    this.controlsForm = document.createElement('form');
    this.controlsForm.id = 'verovio-controls-form';
    this.element.appendChild(this.controlsForm);

    // Zoom controls
    const zoomLabel = document.createElement('label');
    zoomLabel.innerText = 'Scale:';
    this.controlsForm.appendChild(zoomLabel);
    this.zoomCtrl = document.createElement("input");
    this.zoomCtrl.id = 'verovio-zoom';
    this.zoomCtrl.setAttribute('type', 'range');
    this.zoomCtrl.setAttribute('min', 20);
    this.zoomCtrl.setAttribute('max', 200);
    this.zoomCtrl.setAttribute('step', 1);
    this.zoomCtrl.setAttribute('value', `${scale}`);
    this.controlsForm.appendChild(this.zoomCtrl);

    // Layout (horizontal scroll or vertical with wrapping) controls
    const layoutLabel = document.createElement('label');
    layoutLabel.innerText = 'Vertical Scroll (Wrap Systems):';
    this.controlsForm.appendChild(layoutLabel);
    this.layoutCtrl = document.createElement("input");
    this.layoutCtrl.id = 'verovio-layout-wrap';
    this.layoutCtrl.setAttribute('type', 'checkbox');
    this.controlsForm.appendChild(this.layoutCtrl);

    // Highlight color controls
    const hlghtLabel = document.createElement('label');
    hlghtLabel.innerText = 'Highlight Color:';
    this.controlsForm.appendChild(hlghtLabel);
    this.hlghtCtrl = document.createElement("input");
    this.hlghtCtrl.id = 'verovio-hlght';
    this.hlghtCtrl.setAttribute('type', 'color');
    this.hlghtCtrl.setAttribute('value', '#0098F0');
    this.controlsForm.appendChild(this.hlghtCtrl);

    // container for on-the-fly changes to CSS styles (to change highlight color)
    this.customStyle = document.createElement('style');
    this.customStyle.type = 'text/css';
    $("head")[0].appendChild(this.customStyle);

    // Create container element for Verovio SVG
    this.verovioSVG = document.createElement('div');
    this.verovioSVG.id = 'verovio-svg';
    this.element.appendChild(this.verovioSVG);
  }

  getTitle() {
    // Used by Atom for tab text
    return 'MEI Tools';
  }

  getDefaultLocation() {
    // This location will be used if the user hasn't overridden it by dragging the item elsewhere.
    // Valid values are "left", "right", "bottom", and "center" (the default).
    return 'bottom';
  }

  getAllowedLocations() {
    // The locations into which the item can be moved.
    return ['bottom', 'left', 'right'];
  }

  getURI() {
    // Used by Atom to identify the view when toggling.
    return 'atom://mei-tools-atom'
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      deserializer: 'mei-tools-atom/MeiToolsAtomView',
    };
  }

  // Tear down any state and detach
  destroy() {
    this.element.remove();
    this.subscriptions.dispose();
  }

  getElement() {
    return this.element;
  }
}
