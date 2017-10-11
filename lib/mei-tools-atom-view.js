'use babel';

import * as Verovio from 'verovio';
import $ from 'jquery';

export default class MeiToolsAtomView {

  constructor() {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('mei-tools-atom');

    // Create controls
    const controls = document.createElement('div');
    controls.id = 'verovio-controls';
    this.element.appendChild(controls);
    const controlsForm = document.createElement('form');
    controlsForm.id = 'verovio-controls-form';
    controls.appendChild(controlsForm);
    const zoomCtrl = document.createElement("input");
    zoomCtrl.id = 'verovio-zoom';
    zoomCtrl.setAttribute('type', 'range');
    zoomCtrl.setAttribute('min', 20);
    zoomCtrl.setAttribute('max', 200);
    zoomCtrl.setAttribute('step', 1);
    zoomCtrl.setAttribute('value', 45);
    controlsForm.appendChild(zoomCtrl);

    // Create content element
    const verovioSVG = document.createElement('div');
    verovioSVG.id = 'verovio-svg';
    this.element.appendChild(verovioSVG);

    // Create Verovio element
    const vrvToolkit = new Verovio.toolkit();

    // let zoom = 100;

    console.log(zoomCtrl.value);
    const options = {
      inputFormat: 'mei',
      border: 0,
      adjustPageHeight: 1,
      ignoreLayout: 1,
      noLayout: 1,
      scale: +zoomCtrl.value
    };

    vrvToolkit.setOptions(JSON.stringify(options));

    this.subscriptions = atom.workspace.getCenter().observeActivePaneItem(item => {
      if (!atom.workspace.isTextEditor(item)) {
        verovioSVG.innerHTML = "<h2>Open an MEI file to see it rendered here as music notation.</h2>";
        return;
      }

      let path;
      try {
        path = item.getPath();
      } catch (e) {
        console.log(e);
        return;
      }

      if (item.getPath().slice((path.lastIndexOf(".") - 1 >>> 0) + 2) !== "mei") {
        verovioSVG.innerHTML = "<h2>This is not an MEI file. Notation will only be rendered for files ending in .mei that contain valid MEI markup.</h2>";
        return;
      }

      // initial render
      this.updateNotation(item, vrvToolkit, verovioSVG);

      // Zoom management
      zoomCtrl.addEventListener('change', () => {
        this.updateZoom(zoomCtrl.value, options, vrvToolkit);
        this.updateNotation(item, vrvToolkit, verovioSVG);
      });

      // update asynchronously when changes occur
      item.onDidStopChanging(() => {
        this.updateNotation(item, vrvToolkit, verovioSVG);
      });

      // when cursor is moved, highlight notation that matches element at new cursor position
      item.onDidChangeCursorPosition(() => {
        const buffer = item.getBuffer();
        const cursorPos = item.getCursorBufferPosition();
        let id = this.getIdOfItemAtCursor(buffer, cursorPos);
        this.highlightItem(id);
      });
    });
  }

  updateNotation(textEditor, toolkit, target){
    target.innerHTML = "<h2>Loading notation...</h2>";
    target.innerHTML = this.renderVerovio(textEditor.getText(), toolkit);
    this.addNotationEventListeners(target, textEditor);
    this.updateHighlight(textEditor);
  }

  updateHighlight(textEditor){
    let id = this.getIdOfItemAtCursor(textEditor.getBuffer(), textEditor.getCursorBufferPosition());
    this.highlightItem(id);
  }

  updateZoom(newZoom, optionsObj, toolkit){
    optionsObj.scale = +newZoom;
    toolkit.setOptions(JSON.stringify(optionsObj));
  }

  renderVerovio(data, toolkit) {
    let output;

    try {
      output = toolkit.renderData(data, {});
    } catch (e) {
      console.log(e);
      output = `<h2>There was a problem rendering your MEI. Your markup may contain errors or it may be incompatible with Verovio.</h2>`;
    }

    return output;
  }

  addNotationEventListeners(parent, textEditor) {
    let element = $(`#${parent.id} > svg`);
    if (element.length !== 0) {
      $(`#${parent.id} svg g`).bind('mouseup', (el) => {
        this.handleClickOnNotation(el, textEditor);
      });
    }
    else {
      setTimeout(() => {
        this.addNotationEventListeners(parent, textEditor);
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
    const XMLidRe = /(?:xml:id=")(\S+?)(?:")/;

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

    // if closing tag identified, find matching opening tag and set row number accordingly
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
    if (result && Array.isArray(result)) {
      return result[1];
    }

    // if no xml:id is found, return null
    return null;
  }

  highlightItem(id) {
    $('g.highlighted').removeClass('highlighted');
    if (id) {
      $('g#' + id).addClass('highlighted');
    }
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
    return ['top', 'bottom', 'left', 'right'];
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
