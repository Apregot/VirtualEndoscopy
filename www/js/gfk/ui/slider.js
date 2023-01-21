goog.provide('gfk.ui.Slider');
goog.require('goog.dom');
goog.require('goog.ui.Slider');
goog.require('goog.ui.Component.EventType');

/**
* Класс gfk.ui.Slider основан на goog.ui.Slider и расширяет его левой и правой стрелками по концам
* CSS собраны в файле slider.css и основаны на CSS goog/demos/slider.html
* Тестовая страница: tests/gfk-slider.html
*/
gfk.ui.Slider = class  {
	
	constructor(parent) {
    var inset = goog.dom.createDom("div",{"style": "position:absolute;width:100%;top:9px;border:1px inset white;overflow:hidden;height:0;"});
    var thumb = goog.dom.createDom("div",{"class": "goog-slider-thumb"});
    thumb.innerHTML = "&nbsp;&#8741";
    this.sliderDiv = goog.dom.createDom("div",{"class": "goog-slider", "style": "min-width:20px; height: 20px;  flex-grow:2;"},inset,thumb);
    this.slider = new goog.ui.Slider;
    this.leftHandle = goog.dom.createDom("div",{"style": "background-color: ThreeDShadow;"}); 
    this.rightHandle = goog.dom.createDom("div",{"style": "background-color: ThreeDShadow;"});
    this.leftHandle.innerHTML = '◀';	    
    this.rightHandle.innerHTML = '▶';
    this.sliderDivWithArrows = goog.dom.createDom("div",{"style": "display:flex; width:100%;"}, this.leftHandle, this.sliderDiv, this.rightHandle);
		parent.appendChild(this.sliderDivWithArrows);
		this.slider.decorate(this.sliderDiv);
    this._enabled = true;
    this.leftHandle.onclick = ()  => {if(this._enabled) this.slider.setValue(this.getValue()-1)} 
    this.rightHandle.onclick = () => {if(this._enabled) this.slider.setValue(this.getValue()+1)} 
	}
	
	listen(func) {
      	this.slider.addEventListener(goog.ui.Component.EventType.CHANGE, func);
	}

  getValue() {
    return this.slider.getValue();
  }

  setEbabled(enable) {
    this._enabled = enable;
    this.slider.setEnabled(enable); 
  }
}
	// это слайдер со стрелочками
    // <div>
    //   <div class="goog-combobox-button" style="left: 4px; top:-5px; border-right: 1px solid black;">◀</div>
    //   <div id="s1" class="goog-slider" style="width: 200px; height: 20px; display: inline-block;">
    //     <!-- this line is here just to show that custom content can be added -->
    //     <div style="position:absolute;width:100%;top:9px;border:1px inset white;
    //                 overflow:hidden;height:0"></div>
    //     <div class="goog-slider-thumb">&nbsp;&#8741</div>
    //   </div>
    //   <div class="goog-combobox-button" style="left: -4px; top:-5px; border-left: 1px solid black;">▶</div>
    // </div>

/*	
function createButton(b,c) {
   return goog.dom.createDom("div",{"class": "v5-toolbar-button"},
             goog.dom.createDom("div", {"class": "v5-toolbar-icon v5-toolbar-icon-"+b}),
             goog.dom.createDom("div", {"class": "v5-toolbar-caption"},c));

    var progressBarThumb = goog.dom.createDom("div",{
                                                  "class": "progress-bar-thumb",
                                                  "style": "width: 100%;"
                                              });
*/	
