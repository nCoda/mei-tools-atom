'use babel';

import * as Verovio from 'verovio';
import $ from 'jquery';

export default class MeiToolsAtomView {

  constructor() {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('mei-tools-atom');

    // Create control form
    const controlsForm = document.createElement('form');
    controlsForm.id = 'verovio-controls-form';
    this.element.appendChild(controlsForm);

    // Zoom controls
    const initialScale = 45;
    const zoomLabel = document.createElement('label');
    zoomLabel.innerText = 'Scale:';
    controlsForm.appendChild(zoomLabel);
    const zoomCtrl = document.createElement("input");
    zoomCtrl.id = 'verovio-zoom';
    zoomCtrl.setAttribute('type', 'range');
    zoomCtrl.setAttribute('min', 20);
    zoomCtrl.setAttribute('max', 200);
    zoomCtrl.setAttribute('step', 1);
    zoomCtrl.setAttribute('value', `${initialScale}`);
    controlsForm.appendChild(zoomCtrl);

    // Layout (horizontal scroll or vertical with wrapping) controls
    const layoutLabel = document.createElement('label');
    layoutLabel.innerText = 'Vertical Scroll (Wrap Systems):';
    controlsForm.appendChild(layoutLabel);
    const layoutCtrl = document.createElement("input");
    layoutCtrl.id = 'verovio-layout-wrap';
    layoutCtrl.setAttribute('type', 'checkbox');
    controlsForm.appendChild(layoutCtrl);

    // Highlight color controls
    const hlghtLabel = document.createElement('label');
    hlghtLabel.innerText = 'Highlight Color:';
    controlsForm.appendChild(hlghtLabel);
    const hlghtCtrl = document.createElement("input");
    hlghtCtrl.id = 'verovio-hlght';
    hlghtCtrl.setAttribute('type', 'color');
    hlghtCtrl.setAttribute('value', '#0098F0');
    controlsForm.appendChild(hlghtCtrl);

    // container for on-the-fly changes to CSS styles (ex. change highlight color)
    const customStyle = document.createElement('style');
    customStyle.type = 'text/css';
    $("head")[0].appendChild(customStyle);

    // Create container element for Verovio SVG
    const verovioSVG = document.createElement('div');
    verovioSVG.id = 'verovio-svg';
    this.element.appendChild(verovioSVG);

    // Create Verovio toolkit and set default options
    const vrvToolkit = new Verovio.toolkit();

    const vrvOptions = {
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
        verovioSVG.innerHTML = "<h2>Open an MEI file to see it rendered here as music notation.</h2>";
        this.toggleHideForm(controlsForm.id);
        return;
      }

      let path;
      try {
        path = item.getPath();
      } catch (e) {
        console.log(e);
        this.toggleHideForm(controlsForm.id);
        return;
      }

      if (path.slice((path.lastIndexOf(".") - 1 >>> 0) + 2) !== "mei") {
        verovioSVG.innerHTML = "<h2>This is not an MEI file. Notation will only be rendered for files ending in .mei that contain valid MEI markup.</h2>";
        this.toggleHideForm(controlsForm.id);
        return;
      }

      // ensure that form controls are enabled
      this.toggleHideForm(controlsForm.id, false);

      // set Verovio options to defaults, initial render
      this.setOptionsRenderData(item, vrvToolkit, verovioSVG, vrvOptions, {});


      // Listeners

      // when window is resized, if wrapping is enabled, reflow measures
      // TODO: also reflow when pane is resized (observe attributes of parent .atom-dock-content-wrapper)
      $(window).resize(() => {
        if (layoutCtrl.checked) {
          this.setOptionsRenderData(item, vrvToolkit, verovioSVG, vrvOptions, {});
        }
      });

      // when zoom level is changed, update options and re-render notation
      zoomCtrl.addEventListener('change', () => {
        this.setOptionsRenderData(item, vrvToolkit, verovioSVG, vrvOptions, { scale: parseInt(zoomCtrl.value) });
      });

      // when highlight color is change, add/update css in head of document
      layoutCtrl.addEventListener('change', () => {
        const layoutOrientation = layoutCtrl.checked ? 0 : 1;

        this.setOptionsRenderData(item, vrvToolkit, verovioSVG, vrvOptions, { noLayout: layoutOrientation });
      });

      // when highlight color is change, add/update css in head of document
      hlghtCtrl.addEventListener('change', () => {
        this.changeHighlightColor(hlghtCtrl.value, customStyle)
      });

      // update when changes occur in MEI
      item.onDidStopChanging(() => {
        this.updateNotation(item, vrvToolkit, verovioSVG);
      });

      // when cursor is moved, highlight notation that matches element at new cursor position
      item.onDidChangeCursorPosition(() => {
        this.updateHighlight(item);
      });
    });
  }

  updateNotation(textEditor, toolkit, target) {
    target.innerHTML = this.renderVerovio(textEditor.getText(), toolkit);
    this.addNotationEventListeners(target, textEditor);
    this.updateHighlight(textEditor);
  }

  setOptionsRenderData(textEditor, toolkit, target, optionsObj, newOptions = {}) {
    let svgTarget = $('#verovio-svg');

    if (svgTarget.length > 0) {

      // overwrite existing options if any are passed in
      for (let key in newOptions) {
        optionsObj[key] = newOptions[key];
      }

      // recalculate width
      optionsObj.pageWidth = svgTarget.width() * (100 / optionsObj.scale);

      toolkit.setOptions(optionsObj);

      this.updateNotation(textEditor, toolkit, target);

    } else {
      // console.log ('did not find target');
      setTimeout(() => {
        this.setOptionsRenderData(textEditor, toolkit, target, optionsObj, newOptions);
      }, 500);
    }
  }

  updateHighlight(textEditor) {
    let id = this.getIdOfItemAtCursor(textEditor.getBuffer(), textEditor.getCursorBufferPosition());
    $('g.highlighted').removeClass('highlighted');
    if (id) {
      $('g#' + id).addClass('highlighted');
    }
  }

  changeHighlightColor(color, styleEl) {
    styleEl.innerHTML = `.mei-tools-atom #verovio-svg g.highlighted, .mei-tools-atom #verovio-svg g.highlighted, 
    .mei-tools-atom #verovio-svg g.highlighted, .mei-tools-atom #verovio-svg g.highlighted * { 
    fill: ${color}; 
    color: ${color}; 
    stroke: ${color};`;
    // styleEl.styleSheet.cssText = customHighlightCSS;
    // myStyle.appendChild(document.createTextNode(customHighlightCSS));
  }

  toggleHideForm(formID, hide = true) {
    if (hide) {
      $(`#${formID}`).addClass('hidden');
    } else {
      $(`#${formID}`).removeClass('hidden');
    }
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
    let elements = $(`#${parent.id}`).find('g');
    if (elements.length !== 0) {
      elements.bind('mouseup', (el) => {
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
