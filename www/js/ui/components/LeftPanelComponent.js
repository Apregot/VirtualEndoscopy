goog.require('goog.ui.Component');
goog.require('goog.math.Size');
goog.require('goog.ui.SplitPane');
goog.require('gfk.ui.SplitPaneExpanded');
goog.require('gfk.ui.TabBar');

class LeftPanelComponent extends goog.ui.Component {

    /** @param {*} viewer Viewer */
    constructor(viewer) {
        // console.log('LeftPanelComponent() constructor as goog.ui.Component')
        super();
        this._vspl = null;
        this._viewer = viewer;
    }

    /** @override */
    createDom() {
        // console.log('LeftPanelComponent::createDom()')
        super.createDom();
        this.getElement().style.height = "100%";

        // первый параметр null, потому что, gfk.ui.TabBar пока не goog.ui.Component
        // gfk.ui.SplitPaneExpanded         goog.ui.SplitPane
        this._vspl = new gfk.ui.SplitPaneExpanded(new goog.ui.Component(), 
                                                  new FFR.ui.FakeLeftPanelComponent(this._viewer),
                                                        goog.ui.SplitPane.Orientation.VERTICAL);
        this.addChild(this._vspl,true);

        var tabbar = new gfk.ui.TabBar(this._vspl.getChildAt(0).getElement(),['Визуализация','Анализ']);
        tabbar.setTabContent(0,div_vis);
        tabbar.setSelectedTabIndex(0);
    }

    enterDocument() {
      // console.log('LeftPanelComponent::enterDocument()')
      super.enterDocument();
      this._vspl.getElement().style.height = '100%';
      this._vspl.setFirstComponentSize(240);  // подгонка на глаз
      // Это неудавшаяся попытка симитировать gfk.ui.SplitPaneExpanded когда this._vspl является goog.ui.SplitPane
      // почему не сработало - не разобрался
      // this._vspl.getElement().style.height = '100%';
      // this._vspl.getChildAt(0).getElement().style.width = '100%';
      // this._vspl.getChildAt(1).getElement().style.width = '100%';
      // this._vspl.setFirstComponentSize();

      var s12 = new gfk.ui.Slider(document.getElementById('s12')); 
      var s13 = new gfk.ui.Slider(document.getElementById('s13')); 
      var s14 = new gfk.ui.Slider(document.getElementById('s14')); 
      var s15 = new gfk.ui.Slider(document.getElementById('s15')); 
    }

    setVisible(vis) {
      this.getElement().style.display = vis ? 'block': 'none';
    }

    isVisible() {
      return this.getElement().style.display !== 'none';
    }

    print() {
        console.log('myId '+this.getId());
    }

    resize() {
      // console.log('LeftPanelComponent::resize()')
      this._vspl.setFirstComponentSize();
    }    
}

FFR.ui.LeftPanelComponent = LeftPanelComponent;

var div_vis = `<div id="div_vis_grid">
    <div class="grid_row">
      <div style="color:white">Стандартный:</div>
      <div style="display:flex; justify-content:space-between;">
        <select id="sel1"">
          <option>Realistic</option>
          <option>Cardio</option>
        </select>
        <button>Ред.</button>
      </div>
    </div>

    <div class="grid_row">
      <div style="color:white;">Освещение:</div>
      <div style="display:flex;"><input type="checkbox" name="b"><div id="s12" style="flex-grow:2;"></div></div>    
    </div>

    <div class="grid_row">
      <div style="color:white;">Уровень:</div>
      <div id="s13"></div>
    </div>

    <div class="grid_row">
      <div style="color:white;">Порог:</div>
      <div id="s14"></div>
    </div>

    <div class="grid_row">
      <div style="color:white;">Прозрачность:</div>
      <div id="s15"></div>
    </div>

    <div class="grid_row">
      <div style="color:white;">X границы:</div>
      <input type="text" name="a">     
    </div>
    <div class="grid_row">  
      <div style="color:white;">Y границы:</div>
      <input type="text" name="b">
    </div>
    <div class="grid_row">  
      <div style="color:white;">Z границы:</div>
      <input type="text" name="b">
    </div>
    <div class="grid_row">  
      <div style="color:white;">Тип выреза:</div>
      <select id="sel2">
        <option>Без выреза</option>
        <option>Углом</option>
        <option>Передней плоскотью</option>
      </select>
    </div>`;
