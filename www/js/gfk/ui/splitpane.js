goog.provide('gfk.ui.SplitPane');
goog.require('goog.ui.SplitPane');
goog.require('goog.ui.Component');
goog.require('goog.ui.Component.EventType');
goog.require('goog.math.Size');
goog.require('goog.style');

/**
* Класс gfk.ui.SplitPane основан на goog.ui.SplitPane. 
* Допускает использование и через render и через decorate 
*/
gfk.ui.SplitPane = class  {
	
  /**
   * @param {string=} orientation SplitPane orientation; defaults to 'horizontal'
   */  
	constructor(orientation) {
    var orient = goog.ui.SplitPane.Orientation.HORIZONTAL;  // default
    if(orientation && orientation == 'vertical') 
      orient = goog.ui.SplitPane.Orientation.VERTICAL;
    this.parentElement = null;
    this.lhs = new goog.ui.Component();
    this.rhs = new goog.ui.Component();
    this.splitpane = new goog.ui.SplitPane(this.lhs, this.rhs, orient);     
    var showWidth_ = function(e) {
      console.log(e.target.getFirstComponentSize());
    }
    //goog.events.listen(splitpane1, goog.ui.Component.EventType.CHANGE, showWidth_);  
	}

  render(element) {
    this.splitpane.render(element);
    this.parentElement = element;
    // var size = goog.style.getBorderBoxSize(element);
    // console.log('SplitPane.render element.size=',size)
    // this.setSize(size);
  }
  decorate(element) {this.splitpane.decorate(element);}
  setLhsHTMLContent(content) {this.lhs.getElement().innerHTML = content;}
  setRhsHTMLContent(content) {this.rhs.getElement().innerHTML = content;}
  /**
   * @param {Element} element content element for the RHS component.
   */
  setRhsContent(element) {
    this.rhs.getElement().appendChild(element);
  }
  setWidth(width,height,opt_fst_width) {this.splitpane.setSize(new goog.math.Size(width,height),opt_fst_width);} 
/**
 * Set the size of the splitpane.  This is usually called by the controlling
 * application.  This will set the SplitPane BorderBoxSize.
 * @param {!goog.math.Size} size The size to set the splitpane.
 * @param {?number=} opt_fst_width The size of the top or left
 *     component, in pixels.
 */
  setSize(size,opt_fst_width) {this.splitpane.setSize(size,opt_fst_width);}
  // e.clientWidth,e.clientHeight меньше на ширину рамки 5+5px
  getLhsSize() {let e = this.lhs.getElement().parentElement; return new goog.math.Size(e.clientWidth,e.clientHeight);}
  getRhsSize() {let e = this.rhs.getElement().parentElement; return new goog.math.Size(e.clientWidth,e.clientHeight);}
  fitParent() {
    let parentSize = goog.style.getSize(this.parentElement)
    // console.log('parentElement size',parentSize)
    // console.log('my Lhs size', this.getLhsSize())
    // console.log('my Rhs size', this.getRhsSize())
    this.setWidth(parentSize.width)
  }
    
  
  
	// listen(func) {
 //      	this.slider.addEventListener(goog.ui.Component.EventType.CHANGE, func);
	// }
  

}
