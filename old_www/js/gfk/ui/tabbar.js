goog.provide('gfk.ui.TabBar');
goog.require('goog.dom');
goog.require('goog.ui.TabBar');
goog.require('goog.ui.Tab');
goog.require('goog.ui.Button');
goog.require('goog.ui.Component.EventType');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.events.EventHandler');


gfk.ui.TabBar = class {

	constructor(parent,tabs) {
    this.component = new goog.ui.Component();
    this.component.render(parent);
   
    this.tabBar = new goog.ui.TabBar();
    // место постоянного хранения содержимого закладок, когда они не активны
    this._tabDOMs = goog.dom.createDom("div", {"style": "display:none;"});
    document.body.appendChild(this._tabDOMs);
    this._transitDiv = goog.dom.createDom("div", {"style": "display:none;"});
    document.body.appendChild(this._transitDiv);
    //console.log('this.transitDiv_=',this.transitDiv_)
    this._content = [];
    if(tabs) {
      for(var i=0; i<tabs.length; i++) {
         this.tabBar.addChild(new goog.ui.Tab(tabs[i]), true);
         this.setTabContent(i,'<div></div>');
       }
    }

    this.component.addChild(this.tabBar, true);
    parent.appendChild(goog.dom.createDom("div", {"class": "goog-tab-bar-clear"}));
    this.tabContent = goog.dom.createDom("div", {"class": "goog-tab-content"});
    parent.appendChild(this.tabContent);
    goog.events.listen(this.tabBar, goog.ui.Component.EventType.SELECT, (e) => this.handleSelect_(e));
    if(this._content.length > 0) 
      this.tabBar.setSelectedTab(this.tabBar.getChildAt(0));

    this._closeEventListener = null;
	}

	handleSelect_(e) {
    //let cap = e.target.getCaption();
    this.setCurrentContent(this.tabBar.getSelectedTabIndex());
	}

  /** 
   * @param {string} label 
   * @param {boolean=} opt_tabClose     если true, то на закладке создается крестик для закрытия
  */
  addTab(label, opt_tabClose) {
    // console.log('adding new tab '+label)
    let ind = this.tabBar.getChildCount();
    let tab = new goog.ui.Tab(label);

    this.tabBar.addChild(tab, true);

    if(opt_tabClose) {
      let tabElement = tab.getElement();
      let tabCloseEl = goog.dom.createDom(goog.dom.TagName.SPAN, 'gfk-tab-title-close');
      let space = goog.dom.createDom(goog.dom.TagName.SPAN, {"style":"color:white;"} ,'__');
      goog.dom.append(tabElement, space);
      goog.dom.append(tabElement, tabCloseEl);
      // console.log('tabElement',tabElement)
      tab.getHandler().listen(tabCloseEl, goog.events.EventType.CLICK, 
          (e) => {console.log('event handler'); if(this._closeEventListener) this._closeEventListener({target:tab}) });
    }

    this.setTabContent(ind,'<div></div>');
  }

  setContent(node) {
    this.tabContent.appendChild(node);
  }

  // убирает в хранилище (если надо) содержимое текущей закладки и делает текущей закладку ind
  setCurrentContent(ind) {
    //console.log('setSelectedTabIndex('+ind+')')
    if(this.tabBar.getSelectedTabIndex() != -1) 
      if(this.tabContent.firstChild)
        this._tabDOMs.appendChild(this.tabContent.firstChild);
    this.setContent(this._content[ind]);
  }

  setTabContent(tabInd, html) {
    //console.log('setTabContent('+tabInd+',"'+html+'")')
    if(tabInd < this.tabBar.getChildCount() && tabInd >= 0) {
      this._transitDiv.innerHTML = html;
      let tabDOM = this._transitDiv.firstChild;
      this._content[tabInd] = tabDOM;
      this._tabDOMs.appendChild(tabDOM);
    }
  }
  setSelectedTabIndex(ind) {
    if(ind < this.tabBar.getChildCount() && ind >= 0) {
      this.setCurrentContent(ind);
      this.tabBar.setSelectedTab(this.tabBar.getChildAt(ind));
    }
  }

  setEnabled(ind,val) {
    if(ind < this.tabBar.getChildCount() && ind >= 0) 
      this.tabBar.getChildAt(ind).setEnabled(val);
  }

  getTabContentElement(ind) { return (ind < this.tabBar.getChildCount() && ind >= 0) ? this._content[ind] : null; }

  log() {
      console.log('this._tabDOMs',this._tabDOMs)
      console.log('this._content',this._content)
      console.log('this.tabContent',this.tabContent);
  }

  /** 
   *  Установить обработчик кнопки closeTab
   */ 
  setCloseEventListener(listener) {
    this._closeEventListener = listener;
  }
}

/* https://google.github.io/closure-library/api/goog.ui.TabBar.html (https://docs.webix.com/api__refs__ui.tabbar.html)
   Это примеры использования из goog/ui/tabbar_test.js
   ---------------------------------------------------
  var second = new goog.ui.Tab('Second');
  tabBar.addChild(second);
  tabBar.indexOfChild(first));
  tabBar.setLocation(goog.ui.TabBar.Location.START);
  tabBar.setAutoSelectTabs(false);
  tabBar.isAutoSelectTabs());
  tabBar.createDom();
  tabBar.render(sandbox);
  tabBar.addChild(foo = new goog.ui.Tab('foo')); foo.setSelected(true);
  tabBar.setHighlightedIndexFromKeyEvent(0);
  tabBar.setSelectedTab(baz); tabBar.setSelectedTab(null);
  tabBar.setSelectedTabIndex(2); tabBar.setSelectedTabIndex(-1);
  tabBar.deselectIfSelected(foo);
  tabBar.handleTabSelect(new goog.events.Event(goog.ui.Component.EventType.SELECT, bar));      
  assertEquals('Bar must be the selected tab', bar, tabBar.getSelectedTab());
  tabBar.handleTabUnselect(new goog.events.Event(goog.ui.Component.EventType.UNSELECT, foo));      
  foo.setEnabled(false);
  bar.setVisible(false);
  tabBar.handleFocus(new goog.events.Event(goog.events.EventType.FOCUS, tabBar.getElement()));
  tabBar.setSelectedTabIndex(0);
  tabBar.getSelectedTab().setHighlighted(true);

  function countEvent(e) {
    var tabId = e.target.getContent();
    var type = e.type;
    eventCount[tabId][type]++;
  }

  function getEventCount(tabId, type) { return eventCount[tabId][type]; }

  // Listen for SELECT and UNSELECT events on the tab bar.
  goog.events.listen(
      tabBar,
      [
        goog.ui.Component.EventType.SELECT, goog.ui.Component.EventType.UNSELECT
      ],
      countEvent);

  // Clean up.
  goog.events.unlisten(
      tabBar,
      [
        goog.ui.Component.EventType.SELECT, goog.ui.Component.EventType.UNSELECT
      ],
      countEvent);

  see function testExitAndEnterDocument()

  Это примеры из goog/ui/tab_test.js (еще см. API https://google.github.io/closure-library/api/goog.ui.Tab.html)
  ----------------------------------
  tab.getContent()
  tab.isSupportedState(goog.ui.Component.State.SELECTED));
  tab.isAutoState(goog.ui.Component.State.SELECTED));
  tab.setTooltip('Hello, world!');
  tab.setAriaLabel('My tab');
  tab.render();
  var element = tab.getElementStrict();
  element.getAttribute('aria-label'));

  goog.inherits(goog.ui.TabBar, goog.ui.Container);
  ------------------------------------------------
  goog.dom.removeChildren(sandbox); container.dispose(); goog.dispose(keyContainer);
  container.decorate(containerElement);
  container.forEachChild(function(control) {control.getId(); control.isVisible());}
  goog.dom.classlist.add(containerElement, 'goog-container-disabled');
  container.setFocusable(false); container.setFocusableChildrenAllowed(true);

*/
