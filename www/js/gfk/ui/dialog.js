goog.provide('gfk.ui.Dialog');
goog.require('goog.ui.Dialog');
goog.require('goog.style');


/**
* 
*/
gfk.ui.Dialog = class {
  constructor() {
    this.dialog = new goog.ui.Dialog();
    this.dialog.getContentElement();
    //var element = this.dialog.getElement();
    //element.style.width='400px';
    // defaults
    this.dialog.getTitleElement().style.background = '#5f6063';
    this.dialog.getContentElement().style.background = '#909090';    
  }

  show() {this.dialog.setVisible(true);}
  hide() {this.dialog.setVisible(false)}
  log() {console.log('this.dialog',this.dialog);}
  listen(f) {goog.events.listen(this.dialog, goog.ui.Dialog.EventType.SELECT, f);}
  setContent(content) {this.dialog.getContentElement().innerHTML = content;}
  setContentBackground(color) {this.dialog.getContentElement().style.background = color}
  setTitle(title) {this.dialog.setTitle(title);}
  setTitleBackground(color) {this.dialog.getTitleElement().style.background = color;}
  setButtonSet(s) {this.dialog.setButtonSet(s)}
  setSize(w,h) {goog.style.setSize(this.dialog.getContentElement(),w,h)}
}
// export
//window['gfk'] = gfk;
//
