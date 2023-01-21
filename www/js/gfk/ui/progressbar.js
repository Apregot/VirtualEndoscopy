goog.provide('gfk.ui.ProgressBar');
goog.require('gfk.ui.Dialog');
goog.require('goog.ui.Component');
goog.require('goog.ui.ProgressBar');
goog.require('goog.dom');
goog.require('goog.Timer');


/**
* 
*/
gfk.ui.ProgressBar = class {
  constructor() {
      this.dialog = new gfk.ui.Dialog();
      this.dialog.dialog.setDisposeOnHide(true);
      let component = this.dialog.dialog;
      let id1 = component.makeId('pb');
      let id2 = component.makeId('out');
      let id3 = component.makeId('msg');
      this.dialog.setButtonSet(null);
      this.dialog.setContentBackground('#939393');
      this.dialog.setTitle('ProgressBar');
      let contHtml=`<div id="`+id1+`" style="width:400px;">
    <div class="progress-bar-thumb"></div>
    <div id="`+id3+`" style='position:absolute;top:0;text-align:center;width:100%;'>
      Decorated element
    </div>
    <div id="`+id2+`" style='position:absolute;top:0;text-align:left;'></div>
  </div>`
      this.dialog.setContent(contHtml);
      this.dialog.setTitle('Progress bar');
      this.pb2 = new goog.ui.ProgressBar;
      this.pb2.decorate(goog.dom.getElement(id1/*'pb2'*/));
      this.out = goog.dom.getElement(id2);
      this.msg = goog.dom.getElement(id3);
  }

  show() {this.dialog.show();}
  close() {this.dialog.hide()}
  setValue(val) {
    if(val < 0) val = 0;
    if(val > 100) val = 100;
    this.pb2.setValue(val);
    goog.dom.setTextContent(this.out, val + '%'); 
  }
  setMessage(msg) {goog.dom.setTextContent(this.msg, msg); }
  setTitle(title) {this.dialog.setTitle(title);}
  selfTest() {
    var last = 0;
    var delta = 1;
    var t = new goog.Timer(1000);
    let self = this;
    t.addEventListener('tick', function(e) {
      if (last > 100 || last < 0) {
        delta = -delta;
      }
      last += delta;
      self.setValue(last);
    });
    t.start();

    // this.pb2.addEventListener(goog.ui.Component.EventType.CHANGE, function() {
    //   goog.dom.setTextContent(self.out, this.getValue() + '%');
    // });
    this.show();

  }
  // log() {console.log('this.dialog',this.dialog);}
  // listen(f) {goog.events.listen(this.dialog, goog.ui.Dialog.EventType.SELECT, f);}
  // setContent(content) {this.dialog.getContentElement().innerHTML = content;}
  // setContentBackground(color) {this.dialog.getContentElement().style.background = color}
  // setTitle(title) {this.dialog.setTitle(title);}
  // setTitleBackground(color) {this.dialog.getTitleElement().style.background = color;}
  // setButtonSet(s) {this.dialog.setButtonSet(s)}
  // setSize(w,h) {goog.style.setSize(this.dialog.getContentElement(),w,h)}
}
