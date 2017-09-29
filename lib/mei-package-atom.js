'use babel';

import MeiPackageAtomView from './mei-package-atom-view';
import { CompositeDisposable } from 'atom';

export default {

  meiPackageAtomView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.meiPackageAtomView = new MeiPackageAtomView(state.meiPackageAtomViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.meiPackageAtomView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'mei-package-atom:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.meiPackageAtomView.destroy();
  },

  serialize() {
    return {
      meiPackageAtomViewState: this.meiPackageAtomView.serialize()
    };
  },

  toggle() {
    console.log('MeiPackageAtom was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
