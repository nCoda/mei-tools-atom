'use babel';

import $ from 'jquery';
import path from 'path';

export default class MeiToolsAtomView {

  constructor(vt) {
    this.currentPage = 1;
    this.pageCount = 1;
    const initialScale = 45;

    this.createHTMLElements(initialScale);

    // Create Verovio toolkit
    this.vrvToolkit = vt;

    // Create options object with default options
    this.vrvOptions = {
      border: 0,
      adjustPageHeight: 1,
      ignoreLayout: 1,
      noLayout: 0,
      scale: initialScale,
      pageWidth: 100, // has no effect if noLayout is enabled
      pageHeight: 100, // has no effect if noLayout is enabled
    };

    // when highlight color is changed, add/update css in head of document
    this.hlghtCtrl.addEventListener('change', () => {
      this.changeHighlightColor(this.hlghtCtrl.value)
    });

    // observe active pane, display content accordingly
    this.subscriptions = atom.workspace.getCenter().observeActivePaneItem(item => {
      if (!atom.workspace.isTextEditor(item)) {
        this.verovioSVG.innerHTML = "<h2>Open an MEI file to see it rendered here as music notation.</h2>";
        this.hideByID(this.controlsForm.id);
        return;
      }

      let uri;
      try {
        uri = item.getPath();
      } catch (e) {
        console.log(e);
        this.hideByID(this.controlsForm.id);
        return;
      }

      const ext = path.extname(uri);

      if (ext !== ".mei") {
        this.verovioSVG.innerHTML = "<h2>This is not an MEI file. Notation will only be rendered for files ending in .mei that contain valid MEI markup.</h2>";
        this.hideByID(this.controlsForm.id);
        return;
      }

      // ensure that form controls are enabled
      this.hideByID(this.controlsForm.id, false);

      // if file is large (contains many <staff> elements), turn pagination on and hide checkbox
      // that would allow it to be disabled
      this.forcePagination(item.getText());

      // wait for #verovioSVG, then set Verovio options, load MEI data, and do initial render
      this.waitForEl(`#${this.verovioSVG.id}`, () => {
        this.updateAll(item)
      });

      // Toolbar listeners

      // when zoom level is changed, update options and re-render notation
      this.waitForEl(`#${this.zoomCtrl.id}`, () => {
        $(`#${this.zoomCtrl.id}`).off('change').on('change', () => {
          this.updateAll(item)
        });
      });

      // when pagination is enabled or disabled, update options and re-render notation
      this.waitForEl(`#${this.layoutCtrl.id}`, () => {
        $(`#${this.layoutCtrl.id}`).off('change').on('change', () => {
          this.currentPage = 1; // if pagination is toggled, always reset to 1
          const paginated = this.layoutCtrl.checked ? 0 : 1;
          if (paginated === 0) {
            // show pagination controls
            this.hideByID(this.paginationCtrls.id, false);
          } else {
            // hide pagination controls
            this.hideByID(this.paginationCtrls.id);
          }
          this.updateAll(item)
        });
      });

      // when page navigation buttons are clicked, change page displayed
      const handlePageNav = (e) => {
        this.updatePage(item, e.target.value);
      };

      this.waitForEl(`#${this.firstBtn.id}`, () => {
        $(`#${this.firstBtn.id}`).off('click').on('click', handlePageNav);
      });
      this.waitForEl(`#${this.prevBtn.id}`, () => {
        $(`#${this.prevBtn.id}`).off('click').on('click', handlePageNav);
      });
      this.waitForEl(`#${this.nextBtn.id}`, () => {
        $(`#${this.nextBtn.id}`).off('click').on('click', handlePageNav);
      });
      this.waitForEl(`#${this.lastBtn.id}`, () => {
        $(`#${this.lastBtn.id}`).off('click').on('click', handlePageNav);
      });

      // when window is resized, if wrapping is enabled, reflow measures
      $(window).resize(() => {
        if (this.layoutCtrl.checked) {
          this.updateLayout(item)
        }
      });

      // Use a mutation observer to rerender notation when panes are resized or shown/hidden
      const observer = new MutationObserver((m) => {
        if (this.layoutCtrl.checked) {
          // console.log(m);
          this.updateLayout(item)
        }
      });

      const docks = $('.atom-dock-mask');

      for (let i = 0; i < docks.length; i++) {
        observer.observe(docks[i], {
          attributes: true,
          attributeFilter: ['style'],
          subtree: false
        });
      }


      // update when changes occur in MEI code
      item.onDidStopChanging(() => {
        this.forcePagination(item.getText());
        this.updateData(item);
      });

      // when cursor is moved, highlight notation that matches element at new cursor position
      item.onDidChangeCursorPosition(() => {
        this.updateHighlight(item);
      });
    });
  }

  // change options, load new data, render current page, add listeners, highlight
  updateAll(textEditor, options = {}) {
    this.showLoadingMessage();
    this.setVerovioOptions(options);
    this.loadVerovioData(textEditor.getText());
    this.showCurrentPage();
    this.addNotationEventListeners(textEditor);
    this.updateHighlight(textEditor);
  }

  // add new data and render current page without changing options
  updateData(textEditor) {
    this.showLoadingMessage();
    this.loadVerovioData(textEditor.getText());
    this.showCurrentPage();
    this.addNotationEventListeners(textEditor);
    this.updateHighlight(textEditor);
  }

  // go to new page without changing data or options
  updatePage(textEditor, page) {
    this.changeCurrentPage(page);
    this.showCurrentPage();
    this.addNotationEventListeners(textEditor);
    this.updateHighlight(textEditor);
  }

  // update layout with no changes to data or page
  updateLayout(textEditor, options = {}) {
    this.showLoadingMessage();
    this.setVerovioOptions(options);
    this.redoVerovioLayout();
    this.showCurrentPage();
    this.addNotationEventListeners(textEditor);
    this.updateHighlight(textEditor);
  }

  waitForEl(selector, callback) {
    if ($(selector).length > 0) {
      callback();
    } else {
      setTimeout(() => {
        this.waitForEl(selector, callback);
      }, 100);
    }
  }

  getContainerSize() { // use waitForEl to be sure item exists first
    let svgTarget = $(`#${this.verovioSVG.id}`);
    let result = {};

    if (svgTarget.length > 0) {
      result.pageWidth = svgTarget.width();
      result.pageHeight = svgTarget.height();
    } else {
      result = {
        pageWidth: 100,
        pageHeight: 100
      }
    }
    return result;
  }

  redoVerovioLayout() {
    this.vrvToolkit.redoLayout();
    this.pageCount = this.vrvToolkit.getPageCount();
  }

  setVerovioOptions(newOptions = {}) {
    let dimensions = this.getContainerSize();

    // overwrite existing options if new ones are passed in
    for (let key in newOptions) {
      this.vrvOptions[key] = newOptions[key];
    }

    // zoom controls
    this.vrvOptions.scale = parseInt(this.zoomCtrl.value);

    // pagination checkbox
    this.vrvOptions.noLayout = this.layoutCtrl.checked ? 0 : 1;

    if (this.vrvOptions.noLayout === 0) {
      // if pagination is enabled, recalculate width based on parent width and scale
      this.vrvOptions.pageWidth = Math.max(Math.round(dimensions.pageWidth * (100 / this.vrvOptions.scale)), 100);
      this.vrvOptions.pageHeight = Math.max(Math.round(dimensions.pageHeight * (100 / this.vrvOptions.scale)), 100);
    }

    this.vrvToolkit.setOptions(this.vrvOptions);
  }

  loadVerovioData(data) {
    try {
      this.vrvToolkit.loadData(data);
    } catch (e) {
      console.log(e);
      return;
    }

    this.pageCount = this.vrvToolkit.getPageCount();
    if (!this.validateCurrentPage()) {
      // if current page number is not valid, reset to 1
      this.currentPage = 1;
    }
  }

  showCurrentPage() {
    if (!this.validateCurrentPage()) {
      this.currentPage = 1;
    }

    try {
      this.verovioSVG.innerHTML = this.vrvToolkit.renderPage(this.currentPage, {});
    } catch (e) {
      console.log(e);
      return;
    }

    this.updatePageNumDisplay();
  }

  validateCurrentPage() {
    return (this.currentPage > 0 && this.currentPage <= this.pageCount);
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

  changeCurrentPage(newPage) { // accepts number or string (first, last, next, prev)
    let targetpage;
    if ($.isNumeric(newPage)) {
      targetpage = Math.abs(Math.round(newPage));
    } else {
      newPage = newPage.toLowerCase();
      if (newPage === 'first') {
        targetpage = 1
      } else if (newPage === 'last') {
        targetpage = this.pageCount
      } else if (newPage === 'next') {
        if (this.currentPage < this.pageCount) {
          targetpage = this.currentPage + 1;
        }
      } else if (newPage === 'prev') {
        if (this.currentPage > 1) {
          targetpage = this.currentPage - 1;
        }
      } else {
        return;
      }
    }
    if (targetpage > 0 && targetpage <= this.pageCount) {
      this.currentPage = targetpage;
      this.updatePageNumDisplay();
    }
  }

  updatePageNumDisplay() {
    const label = document.getElementById("pagination-label");
    if (label) {
      label.innerHTML = `Page ${this.currentPage} of ${this.pageCount}`;
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

  forcePagination(data) {
    // force pagination for files with more than 100 <staff> elements
    const re = /(?:<staff)(?:\s|>)/g;
    const count = (data.match(re) || []).length;

    if (count > 100) {
      this.layoutCtrl.checked = true;
      this.hideByID(this.paginationToggle.id); // hide toggle
      this.hideByID(this.paginationCtrls.id, false); // make sure page navigation is showed
    } else {
      this.hideByID(this.paginationToggle.id, false);
    }
  }

  showLoadingMessage() {
    this.verovioSVG.innerHTML = `<h2>If your notation fails to load, your markup may contain errors or it may be incompatible with <i>Verovio</i>.</h2>`;
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
    zoomLabel.setAttribute('for', this.zoomCtrl.id);
    this.controlsForm.appendChild(this.zoomCtrl);

    // Highlight color controls
    const hlghtLabel = document.createElement('label');
    hlghtLabel.innerText = 'Highlight Color:';
    this.controlsForm.appendChild(hlghtLabel);
    this.hlghtCtrl = document.createElement("input");
    this.hlghtCtrl.id = 'verovio-hlght';
    this.hlghtCtrl.setAttribute('type', 'color');
    this.hlghtCtrl.setAttribute('value', '#0098F0');
    hlghtLabel.setAttribute('for', this.hlghtCtrl.id);
    this.controlsForm.appendChild(this.hlghtCtrl);

    // Layout (horizontal scroll or vertical with wrapping) controls
    this.paginationToggle = document.createElement('div');
    this.paginationToggle.id = 'pagination-toggle';
    this.controlsForm.appendChild(this.paginationToggle);

    const layoutLabel = document.createElement('label');
    layoutLabel.innerText = 'Paginate?';
    this.paginationToggle.appendChild(layoutLabel);
    this.layoutCtrl = document.createElement("input");
    this.layoutCtrl.id = 'verovio-layout-wrap';
    this.layoutCtrl.setAttribute('type', 'checkbox');
    this.layoutCtrl.setAttribute('checked', 'true');
    layoutLabel.setAttribute('for', this.layoutCtrl.id);
    this.paginationToggle.appendChild(this.layoutCtrl);

    // Pagination
    this.paginationCtrls = document.createElement('div');
    this.paginationCtrls.id = 'pagination-ctrls';
    this.controlsForm.appendChild(this.paginationCtrls);

    this.firstBtn = document.createElement('button');
    this.firstBtn.id = "first-page-btn";
    this.firstBtn.innerHTML = '|<';
    this.firstBtn.setAttribute('type', 'button');
    this.firstBtn.setAttribute('value', 'first');
    this.paginationCtrls.appendChild(this.firstBtn);

    this.prevBtn = document.createElement('button');
    this.prevBtn.id = "prev-page-btn";
    this.prevBtn.innerHTML = '<';
    this.prevBtn.setAttribute('type', 'button');
    this.prevBtn.setAttribute('value', 'prev');
    this.paginationCtrls.appendChild(this.prevBtn);

    const paginationLabel = document.createElement('label');
    paginationLabel.id = 'pagination-label';
    paginationLabel.innerHTML = `Loading`;
    this.paginationCtrls.appendChild(paginationLabel);

    this.nextBtn = document.createElement('button');
    this.nextBtn.id = "next-page-btn";
    this.nextBtn.innerHTML = '>';
    this.nextBtn.setAttribute('type', 'button');
    this.nextBtn.setAttribute('value', 'next');
    this.paginationCtrls.appendChild(this.nextBtn);

    this.lastBtn = document.createElement('button');
    this.lastBtn.id = "last-page-btn";
    this.lastBtn.innerHTML = '>|';
    this.lastBtn.setAttribute('type', 'button');
    this.lastBtn.setAttribute('value', 'last');
    this.paginationCtrls.appendChild(this.lastBtn);

    // container for on-the-fly changes to CSS styles (to change highlight color)
    this.customStyle = document.createElement('style');
    this.customStyle.type = 'text/css';
    $("head")[0].appendChild(this.customStyle);

    // Create container element for Verovio SVG
    this.verovioSVG = document.createElement('div');
    this.verovioSVG.id = 'verovio-svg';
    this.element.appendChild(this.verovioSVG);
  }

  hideByID(id, hide = true) {
    this.waitForEl(`#${id}`, () => {
      const el = $(`#${id}`);
      if (hide) {
        el.addClass('hidden');
      } else {
        el.removeClass('hidden');
      }
    });
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
