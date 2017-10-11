'use babel';

import MeiToolsAtomView from './mei-tools-atom-view';
import { CompositeDisposable, Disposable } from 'atom';

export default {

  subscriptions: null,

  activate(state) {
    require('atom-package-deps').install('mei-tools-atom')
      .then(function() {
        console.log('All dependencies installed, good to go')
      });

    this.subscriptions = new CompositeDisposable(
      // Add an opener for our view.
      atom.workspace.addOpener(uri => {
        if (uri === 'atom://mei-tools-atom') {
          return new MeiToolsAtomView();
        }
      }),

      // Register command that toggles this view
      atom.commands.add('atom-workspace', {
        'mei-tools-atom:toggle': () => this.toggle()
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
  },

  toggle() {
    atom.workspace.toggle('atom://mei-tools-atom');
  },

  deserializeMeiToolsAtomView(serialized) {
    return new MeiToolsAtomView();
  }

};
