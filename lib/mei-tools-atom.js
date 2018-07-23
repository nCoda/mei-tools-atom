'use babel';

import path from 'path';
import fs from 'fs';

import * as Verovio from 'verovio-dev';

import MeiToolsAtomView from './mei-tools-atom-view';
import { CompositeDisposable, Disposable } from 'atom';

const vida = require('../Vida6/dist/vida.min.js');
const VidaController = vida.VidaController;

export default {
  subscriptions: null,
  activeEditor: null,
  vrvToolkit: new Verovio.toolkit(),
  vidaController: new VidaController({
    workerLocation: "../Vida6/src/js/VerovioWorker.js",
    verovioLocation: Verovio,
  }),


  activate(state) {
    require('atom-package-deps').install('mei-tools-atom')
      .then(function () {
        console.log('All dependencies installed, good to go')
      });

    this.subscriptions = new CompositeDisposable(
      // Add an opener for our view.
      atom.workspace.addOpener(uri => {
        if (uri === 'atom://mei-tools-atom') {
          return new MeiToolsAtomView(this.vidaController);
        }
      }),

      // Register commands
      atom.commands.add('atom-workspace', {
        'mei-tools-atom:toggle': () => this.toggle(),
        'mei-tools-atom:convertToMEI': () => this.convertToMEI(),
      }),

      // Observe the active editor
      atom.workspace.observeActiveTextEditor(editor => {
        this.activeEditor = editor;
      }),

      // Destroy any MeiToolsAtomViews when the package is deactivated.
      new Disposable(() => {
        atom.workspace.getPaneItems().forEach(item => {
          if (item instanceof MeiToolsAtomView) {
            item.destroy();
          }
        });
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
    this.activeEditor = null;
    this.vidaController = null;
  },

  toggle() {
    atom.workspace.toggle('atom://mei-tools-atom');
  },

  deserializeMeiToolsAtomView(serialized) {
    return new MeiToolsAtomView();
  },

  resolveNewFileName(path, extensionWithDot) {
    let fullPath = `${path}/untitled${extensionWithDot}`;
    let i = 0;

    while (fs.existsSync(fullPath)) {
      i += 1;
      fullPath = `${path}/untitled${i}${extensionWithDot}`;
    }

    return fullPath;
  },

  convertToMEI() {
    const fullPath = this.activeEditor.getPath()
    const ext = path.extname(fullPath);

    if (ext === ".mei") {
      atom.notifications.addError('Already an MEI file', {
        description: 'Aborting conversion',
        dismissable: true,
      });
      return;
    }

    // if (ext === ".musicxml" || ext === ".xml") {
    //   this.vrvToolkit.loadData(this.activeEditor.getText());
    //   const log = this.vrvToolkit.getLog();
    //
    //   if (log === '') { // success
    //     let newPath = this.resolveNewFileName(path.dirname(fullPath), '.mei');
    //
    //     const mei = this.vrvToolkit.getMEI(1, 1); // page 1, scoreBased
    //
    //     atom.workspace.open(newPath)
    //       .then((textEditor) => {
    //         textEditor.setText(mei)
    //       });
    //
    //   } else { // error
    //     atom.notifications.addError('Error converting to MEI', {
    //       description: 'Please ensure that your MusicXML is valid and try again',
    //       dismissable: true,
    //     });
    //   }
    // }
  },
};
