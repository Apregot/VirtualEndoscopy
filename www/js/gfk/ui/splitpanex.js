goog.provide('gfk.ui.SplitPaneExpanded');
goog.require('goog.ui.Component');
goog.require('goog.ui.SplitPane');
goog.require('goog.asserts');
goog.require('goog.dom.classlist');
// goog.require('goog.ui.Component.EventType');
// goog.require('goog.math.Size');
// goog.require('goog.style');

/**
* Класс gfk.ui.SplitPaneExpanded основан на goog.ui.SplitPane. 
* Это вариант сплиттера, который занимает все доступное место в родительском элементе
* Допускает использование и через render и через decorate 
*/

gfk.ui.SplitPaneExpanded = class extends goog.ui.SplitPane {
	
  /**
   * @param {goog.ui.Component=} fst      optional first component
   * @param {goog.ui.Component=} snd      optional second component
   * @param {string=} orientation         optional SplitPane orientation; defaults to 'horizontal'
   */  
	constructor(fst, snd, orientation) {
    // console.log("gfk.ui.SplitPaneExpanded::constructor()")
    const _lhs = fst || new goog.ui.Component();
    const _rhs = snd || new goog.ui.Component();  
    const _orientation =  orientation &&  orientation === 'vertical' ? 
      goog.ui.SplitPane.Orientation.VERTICAL : goog.ui.SplitPane.Orientation.HORIZONTAL;
                                                                    
    super(_lhs, _rhs, _orientation);
    this._parentElement = null;
    this._ro = null;            // ResizeObserver для parentNode
    // почему то я не могу добраться до super.rhs: это bugfix для Закрыть серию
    this.rhs = _rhs
    this.lhs = _lhs 
	}

  /** @override */
  enterDocument() {
    // console.log('SplitPaneExpanded::enterDocument()')
    super.enterDocument();
    // это особенность gfk.ui.SplitPaneExpanded - он занимает в родителе всю возможную область по высоте и ширине
    this.getElement().style.height = '100%';
    this._parentElement = this.getElement().parentElement;
    goog.asserts.assert(this._parentElement, 'Parent element must not be null.');

    // делаем первую и вторую компоненту расширяемую по height: 100%
    let firstEl = this.getChildAt(0).getElement();
    let secondEl = this.getChildAt(1).getElement();
    firstEl.style.height = '100%', firstEl.style.background ='#ddd;'
    secondEl.style.height = '100%', secondEl.style.background ='#ddd;'


    // устанавливаем ResizeObserver на parent element
    // это пока не работает в min варианте, GCC не понимает, что такое ResizeObserver
    this._ro = new ResizeObserver(entry => {
      // console.log('ResizeObserver handleResize for',entry)
      this.setFirstComponentSize();
    });
    // console.log('ro', ro)
    this._ro.observe(this._parentElement);
  }

  disposeInternal() {
    console.log('SplitPaneExpanded::disposeInternal()');
    super.disposeInternal();
    this._ro.unobserve(this._parentElement);
  }

  // /** @override */
  // exitDocument() {
  // }

  // render(element) {
  //   super.render(element);
  //   console.log('SplitPaneExpanded::render()',element)
  // }

  // setLhsHTMLContent(content) {this.lhs.getElement().innerHTML = content;}
  // setRhsHTMLContent(content) {this.rhs.getElement().innerHTML = content;}
  /**
   * @param {Element} element content element for the RHS component.
   */
  // setRhsContent(element) {
  //   this.rhs.getElement().appendChild(element);
  // }
  // setWidth(width,height,opt_fst_width) {this.splitpane.setSize(new goog.math.Size(width,height),opt_fst_width);} 
/**
 * Set the size of the splitpane.  This is usually called by the controlling
 * application.  This will set the SplitPane BorderBoxSize.
 * @param {!goog.math.Size} size The size to set the splitpane.
 * @param {?number=} opt_fst_width The size of the top or left
 *     component, in pixels.
 */
  // setSize(size,opt_fst_width) {this.splitpane.setSize(size,opt_fst_width);}
  // e.clientWidth,e.clientHeight меньше на ширину рамки 5+5px
  // getLhsSize() {let e = this.lhs.getElement().parentElement; return new goog.math.Size(e.clientWidth,e.clientHeight);}
  // getRhsSize() {let e = this.rhs.getElement().parentElement; return new goog.math.Size(e.clientWidth,e.clientHeight);}
  // fitParent() {
  //   let parentSize = goog.style.getSize(this.parentElement)
  //   // console.log('parentElement size',parentSize)
  //   // console.log('my Lhs size', this.getLhsSize())
  //   // console.log('my Rhs size', this.getRhsSize())
  //   this.setWidth(parentSize.width)
  // }
    
  
  
	// listen(func) {
 //      	this.slider.addEventListener(goog.ui.Component.EventType.CHANGE, func);
	// }
  

}
