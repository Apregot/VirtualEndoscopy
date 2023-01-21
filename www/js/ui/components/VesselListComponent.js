goog.require('goog.ui.Container');
goog.require('goog.ui.PopupMenu');
goog.require('goog.ui.MenuItem');

class VesselListComponent extends goog.ui.Container {
    constructor() {
        // console.log('VesselListComponent::constructor()')
        super();
        this._id = this.makeId('d12s'); 
    }

    /** @override */
    createDom() {
        // console.log('VesselListComponent::createDom()')

        super.createDom();

        let contentHTML =     
 `<div style="height:100%; background:#ddd; display:flex; flex-direction:column; justify-content:space-between;">
      <select style="width:100%; margin:5px 0px 5px 0px;"><option>Edit</option><option>Change label</option></select>
      <select id="${this._id}" size="8"></select>      
      <button style="width:100%">Удалить сосуд</button>
 </div>`;
        
        this.getElement().innerHTML = contentHTML;
    }

    enterDocument() {
        // console.log('VesselListComponent::enterDocument()')
        super.enterDocument();
        let selectElement = this.getElementByFragment('d12s');

        // отладка
        // let x = document.createElement("OPTION"); x.label = 'AAA'; x.value = 'BBB';
        // selectElement.appendChild(x)

        selectElement.addEventListener('change', (e) => {
            // const msg = `change event on select element: value=${e.target.value}`
            // console.log(msg)
            this.dispatchEvent({type:FFR.ui.events.VesselListComponent.SELECT, value:e.target.value});
        });
        // selectElement.addEventListener('contextmenu', (e) => console.log('contextmenu',e.target.value))
        selectElement.oncontextmenu = (e) => {
            if(e.target.value) {
                e.preventDefault(); 

                var rContextMenu = new goog.ui.PopupMenu();

                // Так можно ассоциировать с меню или  MenuItem любую информация
                rContextMenu.setModel(e.target.value);

                rContextMenu.addItem(new goog.ui.MenuItem(e.target.value));
                rContextMenu.addItem(new goog.ui.MenuSeparator());
                rContextMenu.addItem(new goog.ui.MenuItem('Удалить сосуд'));
                rContextMenu.addItem(new goog.ui.MenuItem('Виртуальная эндоскопия'))
                rContextMenu.addItem(new goog.ui.MenuItem('Маркировка стеноза'))

                rContextMenu.render(document.body);
                rContextMenu.showAt(e.clientX,e.clientY,goog.positioning.Corner.BOTTOM_LEFT);
                rContextMenu.setVisible(true);

                goog.events.listen(rContextMenu, 'action', (e) => {
                    // console.log('action ', e.target.getCaption(), 'for ', e.currentTarget.getModel())
                    const cap = e.target.getCaption(), vesselName = e.currentTarget.getModel();
                    const ev = cap === 'Удалить сосуд' ? FFR.ui.events.VesselListComponent.REMOVE :
                               cap === 'Виртуальная эндоскопия' ? FFR.ui.events.VesselListComponent.VIRTUALENDOSCOPY :
                               cap === 'Маркировка стеноза' ? FFR.ui.events.VesselListComponent.MARKSTENOSIS : 'unknown';
                    // ------------------------------------------------
                    // Удаление сосуда обрабатывается здесь
                    if(ev == FFR.ui.events.VesselListComponent.REMOVE) {
                        // let option = this._findOption(vesselName);
                        // selectElement.removeChild(option)
                        // this.clear();
                        // if(option) option.selected = true;
                        // console.log('selectElement',selectElement,children,children[0].tagName,children[1].tagName,children[1].label)
                        // selectElement.removeChild(children[1])
                        // let x = document.createElement("OPTION"); x.label = 'AAA';
                        // selectElement.appendChild(x)
                    }
                    else if(ev == FFR.ui.events.VesselListComponent.VIRTUALENDOSCOPY ||
                            ev == FFR.ui.events.VesselListComponent.MARKSTENOSIS       ) {
                        this.selectOption(vesselName);
                    }
                    // ------------------------------------------------

                    this.dispatchEvent({type:ev, value:vesselName});          
                });
            }
            // rContextMenu(e)
        }
        // https://stackoverflow.com/questions/26386473/create-a-specific-menu-right-click-on-a-html-select-option
        //   ev.stopPropagation();
        //   ev.preventDefault();
        //   rightclick();
        //   return false;        
        // goog.events.listen(this.tabBar, goog.ui.Component.EventType.SELECT, (e) => this.handleSelect_(e));
    }

    selectOption(vesselName) {
        let option = this._findOption(vesselName);
        if(option) option.selected = true;        
    }


    /**
     * Возвращает ссылку на OPTION элемент в списке по label
     * @param {string} name OPTION label
     * @return {Node|null}
     */
    _findOption(name) { 
        let selectElement = this.getElementByFragment('d12s'); 
        let children = selectElement.childNodes;
        for(let i=0; i< children.length; i++)
            if(children[i].tagName == 'OPTION' && children[i].label == name)
                return children[i];
        return null;
    }

    /**
     * Добавляет в список данные имена
     * @param {Array<string>} vesselNames
     */
    add(vesselNames) {
        // console.log('VesselListComponent::add()')
        let selectElement = this.getElementByFragment('d12s');
        for(let i=0; i<vesselNames.length; i++) {
            let x = document.createElement("OPTION");
            x.label = vesselNames[i];
            x.value = vesselNames[i];
            selectElement.appendChild(x)
        }
    }

    /**
     * Очистка селектора со списком сосудов
     */
    clear() {
        //console.log('VesselListComponent::clear()')
        let selectElement = this.getElementByFragment('d12s');
        while(selectElement.childNodes.length > 0) {
            //console.log(selectElement.childNodes[0])
            selectElement.removeChild(selectElement.childNodes[0]);  
        }
    }

    print() {
        console.log('myId '+this.getId());
    }
}


FFR.ui.VesselListComponent = VesselListComponent;
FFR.ui.events.VesselListComponent = {
    SELECT: 'select',
    REMOVE: 'remove',
    MARKSTENOSIS: 'markstenosis',
    VIRTUALENDOSCOPY: 'virtualendoscopy'
};