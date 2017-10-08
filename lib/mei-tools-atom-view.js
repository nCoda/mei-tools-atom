'use babel';

import * as Verovio from 'verovio';

const $ = require('jquery');

export default class MeiToolsAtomView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('mei-tools-atom');

    // Create content element
    const verovioSVG = document.createElement('div');
    verovioSVG.classList.add('verovio-svg');
    this.element.appendChild(verovioSVG);

    // Create mutationObserver
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log(mutation.type);
        this.addNotationEventListeners(verovioSVG);
      });
    });

    const config = { attributes: true, childList: true, characterData: true, subtree: true };

    this.observer.observe(verovioSVG, config);

    // Create Verovio element
    const vrvToolkit = new Verovio.toolkit();
    let zoom = 45;

    const options = {
      inputFormat: 'mei',
      border: 0,
      adjustPageHeight: 1,
      ignoreLayout: 1,
      noLayout: 1,
      scale: zoom
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
      verovioSVG.innerHTML = this.renderVerovio(item.getText(), vrvToolkit);

      // update asynchronously when changes occur
      item.onDidStopChanging(() => {
        verovioSVG.innerHTML = this.renderVerovio(item.getText(), vrvToolkit);
      });

      // when cursor is moved, highlight notation that matches element at new cursor position
      item.onDidChangeCursorPosition(() => {
        const buffer = item.getBuffer();
        const cursorPos = item.getCursorBufferPosition();
        let id = this.getIdOfItemAtCursor(buffer, cursorPos);
        if (id) {
          this.highlightItem(id);
        }
      });
    });
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

  addNotationEventListeners(parent) {
    $(`.${parent.classList[0]} svg g`).bind('mouseup', (el) => {
      this.handleClickOnNotation(el);
    });
  }

  handleClickOnNotation(e) {
    console.log(e.currentTarget.id);
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
        tag = line.slice(j - 1).match(closingTagRe);
        if (tag && Array.isArray(tag)) {
          tag = tag[tag.length - 1];
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

    // otherwise, look through previous rows until one is found
    for (let i = row - 1; i > 0; i--) {
      result = text.lineForRow(i).match(XMLidRe);

      if (result && Array.isArray(result)) {
        return result[1];
      }
    }

    // if no xml:id is found, return null
    return null;
  }

  highlightItem(id) {
    $('g.highlighted').removeClass('highlighted');
    $('g#' + id).addClass('highlighted');
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
