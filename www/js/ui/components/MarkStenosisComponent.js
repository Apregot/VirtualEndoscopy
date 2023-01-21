goog.require('goog.ui.Container');
goog.require('goog.ui.Component');
goog.require('goog.events');
goog.require('goog.math.Size'); 
goog.require('goog.ui.TwoThumbSlider');
goog.require('goog.style');
goog.require('goog.html.SafeStyleSheet');
goog.require('gfk.ui.SplitPaneExpanded');
goog.require('gfk.ui.TabBar');
goog.require('gfk.ui.Slider');

class MarkStenosisComponent extends goog.ui.Component {
    /**
     * @param {goog.math.Size} lhsSize   Размер панели
     * @param {*} state {
     *  stack,      // AMI.StackModel
     *  aortaCube,  // Cube
     *  vessels,    // [v0Cube,v1Cube] v0 - LCA, v1 - RCA
     *  vesselsObj, // {LCA:{cube,mesh,color}, RCA:{..}}
     *  vesselInfo, //[] массив объектов
     *      {   // поля name, burificationPoints и centerline приходят с сервера
     *          name,                       // String
     *          burificationPoints,         // Float64Array
     *          centerline,                 // Float64Array
     * 
     *          // следующие поля добавлены при маркировке стеноза
     *          // в MarkStenosisComponent или VesselHistogramComponent
     *          centerlineMesh,             // {THREE.BufferGeometry+THREE.LineBasicMaterial}
     *          artery,                     // ссылка на vesselsObj.LCA или RCA
     *          profile,                    // [] профиль сосуда может быть undefined
     *          // массив мешей, соотвествующих селектированным столбикам гистограммы
     *          // если отмечен непрерывный диапазон столбиков, например, 57 и 58, то ему будет соотвествовсть 
     *          // объект {range:[57,58], mesh, stenosis}, то есть диапазон имеет объединенный mesh
     *          // mesh для tube всегда не null, а stenosis может быть null, если для этой tube не был сделан
     *          // capture stenosis
     *          tubes [{range [], mesh, stenosis}],  
     * 
     *      }
     * 
     *  Поля, которые начинаются с _ добавляются в state MarkStenosisComponent, так как state
     *  является общими данными с VesselHistogramComponent
     * 
     *  _stenosisList,  // [] массив объектов
     *      {
     *          id,             // то что изображается после стеноз# то есть номер стеноза
     *          vessel,         // сосуд, на котором поставлен стеноз
     *          tube,           // ссылка на элемент vessel.tubes[]
     *          percentId,      // ID <input> %% стеноза 
     *          UserStenosisPercent,    // величина в <input> %% стеноза 
     *          color,          // цвет: string используется в .fill() buildHistogram
     *          deleteId,       // ID <button> delete
     *      }
     * } 
     * 
     *  async parse_input_data():
     *  async parse_FFRfull():
     * 
     *  input_data {
     *          LCA:{nodes:[[x,y,z]], ribs:[{n1,n2,segLengthCM,segDiameterCM,vesselMap:{vessel,range:[],dist:[]}}]},
     *          RCA:.., 
     *          stenosis: [{branch:1-LCA| 2-RCA, ribIndex, type }]
     *  }
     *  FFRfull {LCA:[ {step:Number, ffr_value:[Number..]}, RCA:.. ]}
     */
    constructor(lhsSize, state) {
        // console.log('MarkStenosisComponent() constructor-1')
        super();
        this._state = state;
        this._state.vesselsObj = {  LCA: {cube: state.vessels[0], mesh:null, color:0xf80100},                      
                                    RCA: {cube: state.vessels[1], mesh:null, color:0xd28e0c} 
                                 };

        // это распечатка статистики в т.ч ROI; true означает печатать на консоль
        console.log('распечатка статистики аорты и сосудов-2')
        this._state.aortaCube.nonzerostats(true);
        this._state.vesselsObj.LCA.cube.nonzerostats(true);
        this._state.vesselsObj.RCA.cube.nonzerostats(true);
        let r = this._state.aortaCube._protoCube.ROI;
        const v3 = (x,y,z) => new THREE.Vector3(x,y,z)
        let abox = new THREE.Box3(v3(r[0],r[2],r[4]),v3(r[1],r[3],r[5]))
        r = this._state.vesselsObj.LCA.cube._protoCube.ROI;
        let lbox = new THREE.Box3(v3(r[0],r[2],r[4]),v3(r[1],r[3],r[5]))
        r = this._state.vesselsObj.RCA.cube._protoCube.ROI;
        let rbox = new THREE.Box3(v3(r[0],r[2],r[4]),v3(r[1],r[3],r[5]))
        let ROI = abox.clone().union(lbox).union(rbox);
        console.log('общий (аорта+сосуды) ROI', ROI)
        console.log(`minROI=[${ROI.min.x}x${ROI.max.x},${ROI.min.y}x${ROI.max.y},${ROI.min.z}x${ROI.max.z}]`)

        this._state._stenosisList = [];
        this._stenosisCnt = 0;  // порядковый номер стеноза для формирования уникального ID

        this._vesselHistogramComponent = null;

        /** @type {goog.math.Size} */ 
        this.lhsSize = lhsSize;
        /** -@type {gfk.ui.SplitPane} сплиттер на месте левой панели*/
        this._vspl = null;              
        /** -@type {gfk.ui.TabBar} Tabbar в верхней части сплиттера*/
        this.tabbar = null;
        /** -@type {FFR.ui.VesselListComponent} список сосудов в нижней части сплиттера - ругается unknown type*/
        this._vesselList = null;        
        this._myTabIndex = 0;
        this.twoThumbSlider = null;
        // это данные, которые инициализируются в start
        this._stack = null;
        this.visArea = null;        // UP3 render object 

        this._selectedCenterlineIndex = -1;

        this.r4 = null;   // используется в виртуальной эндоскопии
        this.cameraHelperR4 = null; 
        /** @enum {string} */
        this.IdFragment = {     // цифры - не требуют addListener, буквы - требуют
            MARKER: '0',
            CLEARLISTBUTTON: 'c',
            CAPTURESTENOSOSBUTTON: 'e',
            STARTCALCULATIONBUTTON: 'f',
            REFSTENOSIS: 'j',

            STENOSISINFO: '1',
            VESSELNAME: '2',
            TESTINFODIV: '3',
            STENOSISLIST: '4',
            // virtual endoscopy controls
            VE_CAMERA: '8',
            VE_BUTTON_SMOOTH: '9',
         }

         this._FFRvalue = undefined;    // здесь сохряняется величина FFR после расчета 

         this._ve_cameraSlider = null;
         this._onion = new Onion(state);
         this.infoDiv = null;

         //this.test();
         //printVesselInfo(this._state.vesselInfo)
    }

    test() {
        console.log('MarkStenosisComponent test')
        //const n = [11.0638, 10.34, 10.625]
        const n = [8.424, 9.1125, 7]
        const vessels = this._state.vesselInfo, stack = this._state.stack;
        //console.log(vessels)
        let objs = []
        for(let vessel of vessels) {
            let obj = checkNodeOnCenterline(stack, n, vessel)
            objs.push(obj)
        }
        console.table(objs);
    }

    resize() {
        // console.log('MarkStenosisComponent::resize()')
        const visArea = this.visArea;

        // по аналогии с quadview resize
        visArea.camera.aspect = visArea.domElement.clientWidth / visArea.domElement.clientHeight;
        visArea.camera.updateProjectionMatrix();
        visArea.renderer.setSize(visArea.domElement.clientWidth, visArea.domElement.clientHeight);
    }
    /** @override */
    createDom() {
        // console.log('MarkStenosisComponent::createDom()')
        super.createDom();
        this.getElement().style.height = "100%";

        // this._vspl = new gfk.ui.SplitPaneExpanded(null, null, 'vertical'); new goog.ui.SplitPane
        this._vspl = new gfk.ui.SplitPaneExpanded(new goog.ui.Component(), new goog.ui.Component(),goog.ui.SplitPane.Orientation.VERTICAL)
        // this._vspl.render(this.getElement());
        this.addChild(this._vspl,true);
        this._vspl.setFirstComponentSize(440);

        this.tabbar = new gfk.ui.TabBar(this._vspl.getChildAt(0).getElement(),['Маркировка стеноза', 'Вирт. эндоскопия']);
        //  justify-content: space-between;
        var tab0HTML = 
        `<div  class="content">
            Сосуд: <b><span id="${this.makeId(this.IdFragment.VESSELNAME)}"></span></b>
            <div style="display:flex;">
                Видимость аорты <input type="checkbox" id="${this.makeId(this.IdFragment.REFSTENOSIS)}" checked>
            </div>
            <div style="display:flex; width:100%;">
                Прозрачность:
                <span title="левый маркер влево">◀</span> 
                <div id="${this.makeId(this.IdFragment.MARKER)}" style="min-width:20px; height: 20px; width:100%; flex-grow:2;"></div>
                <span title="правый маркер вправо">▶</span>
            </div>
            <p>
            <p>
            <fieldset>
                <legend>Информация о пациенте</legend>
                <div id="${this.makeId(this.IdFragment.STENOSISINFO)}"></div>
                 <div style="display: grid; grid-template-columns: 3fr 4fr">
                    <div>Psys (mmHg)</div> <div><input id="Psys" type="number" value="120" style="width: 5em;"/></div>
                 </div>
                 <div style="display: grid; grid-template-columns: 3fr 4fr">
                    <div>Pdia (mmHG)</div> <div><input id="Pdia" type="number" value="80" style="width: 5em;"/></div>
                 </div>
                 <div style="display: grid; grid-template-columns: 3fr 4fr">
                    <div>SV (ml)</div> <div><input id="SV" type="number" value="60" style="width: 5em;"/></div>
                 </div>
                 <div style="display: grid; grid-template-columns: 3fr 4fr">
                    <div>HR (bpm)</div> <div><input id="HR" type="number" value="60" style="width: 5em;"/></div>
                 </div>
            </fieldset>
            <p>
            <fieldset id="${this.makeId(this.IdFragment.STENOSISLIST)}">
                <legend>Список стенозов</legend>
            </fieldset>
            <p>
            <button id="${this.makeId(this.IdFragment.STARTCALCULATIONBUTTON)}" disabled>Start Calculation</button>
            <button id="${this.makeId(this.IdFragment.CAPTURESTENOSOSBUTTON)}">Capture stenosis</button> 
            <button id="${this.makeId(this.IdFragment.CLEARLISTBUTTON)}" disabled>Clear list</button>
            <div id="${this.makeId(this.IdFragment.TESTINFODIV)}"></div>
            <hr/>
        </div>`;

        var tab1HTML = `<div id="div_vis_grid">
            <div class="grid_row">
              <div style="color:white">Сглаживание:</div>
              <div style="display:flex; justify-content:space-between;">
                <button id="${this.makeId(this.IdFragment.VE_BUTTON_SMOOTH)}">Сгладить +1</button>
              </div>
            </div>

            <div class="grid_row">
              <div style="color:white;">Освещение:</div>
              <div style="display:flex;"><input type="checkbox" name="b"><div id="s12" style="flex-grow:2;"></div></div>    
            </div>

            <div class="grid_row">
              <div style="color:white;">Позиция камеры:</div>
              <div id="${this.makeId(this.IdFragment.VE_CAMERA)}"></div>
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

          
        this.tabbar.setTabContent(this._myTabIndex,tab0HTML)
        this.tabbar.setTabContent(1,tab1HTML)
        this.tabbar.setSelectedTabIndex(this._myTabIndex);
        let tab1 = /** @type {goog.ui.Tab} */ (this.tabbar.tabBar.getChildAt(1));
        tab1.setVisible(false); //tab1.setEnabled(false);     
        // this.tabbar.tabBar.getChildAt(0).setEnabled(false);

        this.twoThumbSlider = new goog.ui.Slider()//new goog.ui.TwoThumbSlider(); 
        // this.twoThumbSlider.createDom();
        // var el1 = this.twoThumbSlider.getElement();
        // el1.style.height = '20px';
        // this.twoThumbSlider.setEnabled(false);
    }

    enterDocument() {

        console.log('MarkStenosisComponent::enterDocument()')

        super.enterDocument();
        // debugger;
        this._vesselList = new FFR.ui.VesselListComponent();
        this._vspl.getChildAt(1).addChild(this._vesselList,true);
    
        var events = [
            FFR.ui.events.VesselListComponent.SELECT, FFR.ui.events.VesselListComponent.REMOVE,
            FFR.ui.events.VesselListComponent.MARKSTENOSIS, 
            FFR.ui.events.VesselListComponent.VIRTUALENDOSCOPY
        ];

        goog.events.listen(this._vesselList, events, (e) => this._vesselListActionHandler(e));   

        this.twoThumbSlider.createDom();
        this.twoThumbSlider.render(this.getElementByFragment(this.IdFragment.MARKER))
        this.twoThumbSlider.getElement().style.height = '20px';
        this.twoThumbSlider.addEventListener(goog.ui.Component.EventType.CHANGE, () => this._markerRangeChanged());

        //=====================
        function logEvent(e) {
          // console.log(e,' dispatched: ' + e.type);
        }
        var EVENTS = goog.object.getValues(goog.ui.Component.EventType);
        goog.events.listen(this.twoThumbSlider, EVENTS, logEvent);   
        goog.events.listen(this, EVENTS, logEvent);   
        //=====================

        for(let prop in this.IdFragment) {
            const c = this.IdFragment[prop].charAt(0);
            if(c >= 'a' && c <= 'z')
                this.getElementByFragment(this.IdFragment[prop]).addEventListener('click', e => this._mouseEventHandler(/** @type {MouseEvent}*/(e)));
        }
        
        this._ve_cameraSlider = new gfk.ui.Slider(this.getElementByFragment(this.IdFragment.VE_CAMERA));

        this.start(this._state);
        let ind = this._getLongestVesselIndex(), name = this._state.vesselInfo[ind].name;
        // console.log('longest vessel ',name, ind);
        this._initStenosisMarkup(name);
        this._manageButtonState()
        this.startRendering();
        //this._onion.vesselProfile();
        //new RainbowObj(this._state).parse()

        //new PlasticBoy(this._state, this.visArea).colorTubesByFFR()

    }

    /**
     * Обработчик событий SELECT/REMOVE/MARKSTENOSIS/VIRTUALENDOSCOPY
     * @param {goog.events.Event} e
     */
    _vesselListActionHandler(e) {
        // e.type="select" | "remove" .. FFR.ui.events.VesselListComponent.*
        const eventType = e.type, vesselName = e.value;
        // console.log(e,e.type, e.value)
        switch(eventType) {
            case FFR.ui.events.VesselListComponent.SELECT:      this._setSelectedVessel(vesselName); break;
            case FFR.ui.events.VesselListComponent.REMOVE:      this._removeVessel(vesselName); break;
            case FFR.ui.events.VesselListComponent.MARKSTENOSIS:this._initStenosisMarkup(vesselName); break;
            case FFR.ui.events.VesselListComponent.VIRTUALENDOSCOPY: this._virtualEndoscopy(vesselName); break;
        }
    }

    /** 
     * Функция возвращает индекс сосуда по данному ей имени.
     * @param {string} vesselName 
     * @return {number} индекс сосуда или -1
     * 
     */ 
    _setSelectedVessel(vesselName) {
        // console.log('_setSelectedVessel')
        let found = this._state.vesselInfo.find( (item, index) =>{
            if(item.name == vesselName) {
                // console.log(vesselName+' has index '+index)
                if(this._selectedCenterlineIndex != -1)
                    this._state.vesselInfo[this._selectedCenterlineIndex].centerlineMesh.visible = false;
                this._selectedCenterlineIndex = index;
                this._state.vesselInfo[this._selectedCenterlineIndex].centerlineMesh.visible = true;
                if(this._vesselHistogramComponent)
                    this._vesselHistogramComponent.setSelectedVessel(this._selectedCenterlineIndex);
                return true;
            }
            else return false;
        });  
        // if(!found) 
        //     console.log('_setSelectedVessel: not found vessel ' + vesselName);   
        return !found ? -1 :  this._selectedCenterlineIndex;
    }

    /** 
     * Функция обработки сигнала от VesselList, что пользователь удаляет сосуд
     * @param {string} vesselName 
     * 
     * Обработка:
     * 1) Удалить сосуд из массива VesselInfo. Если на сосуде были установлены стенозы
     *    то спросить подтверждение и почистить информацию о стенозах.
     * 2) Переименовать оставшиеся в ветке сосуды 'Left vessel: N\n'
     * 3) Обновить список в VessselListComponent clear+add
     * 
     * Предположения: FFR_DeleteVessel не меняет геометрию оставшихся сосудов (центральные линии
     * и точки ветвлений), и не меняет маски LCA и RCA, поэтому перестраивать сетки в QuadView 
     * не надо. Интересно, а когда исчезает целиком левая или правая ветвь, то что? 
     * Мультивокс часто падает при удалении сосудов, то есть этв функциональность нестабильна
     * 
     */ 
    async _removeVessel(vesselName) {
        //console.log(`MarkStenosisComponent::_removeVessel(${vesselName})`);
        const ind = this._state.vesselInfo.findIndex( item => (item.name == vesselName) )

        console.assert(ind != -1, `MarkStenosisComponent::_removeVessel: сосуд ${vesselName} найден`)

        if(ind != -1) {
            const ret = await FFR.viewer._FFRsrv.DeleteVessel(ind)
            console.assert(ret == 'ok',`FFR_DeleteVessel returned ${ret}`)

            const vessel = this._state.vesselInfo[ind]
            if(vessel.tubes && vessel.tubes.length > 0) {
                const ans = confirm('Вы хотите удалить сосуд со стенозом?')
                if(ans == false) return;
            }

            // Переименование сосудов. Здесь предполагаем, что никаких пользовательских имен 
            // сосудов не существует. Как было названо сервером, так и осталось
            //
            const namePattern = vessel.artery == this._state.vesselsObj.LCA ?
                                    'Left vessel:' : 'Right vessel:';
            let vnum = parseInt(vessel.name.slice(namePattern.length+1))

            for(let i = ind+1; i < this._state.vesselInfo.length; i++) {
                if(this._state.vesselInfo[i].artery != vessel.artery) break;
                this._state.vesselInfo[i].name = `${namePattern} ${vnum++}`        
            }

            // TBD: почистить стенозы            
            this.visArea.scene.remove(vessel.centerlineMesh)
            this._state.vesselInfo.splice(ind,1)
            this._vesselList.clear()
            this._vesselList.add(this._state.vesselInfo.map( item => item.name))
            this._selectedCenterlineIndex = -1;
            //printVesselInfo(this._state.vesselInfo)


            // до и после
            // const info = await FFR.viewer._ffrDriver.getVesselInfo()
            // printVesselInfo(this._state.vesselInfo)
            // console.log('vessel info after delete', info)
            // printVesselInfo(info)
        }
    }

    /**
     * Функция возвращает сосуд с наибольшим количеством точек в центральной линии
     * @return {number}
     */
    _getLongestVesselIndex() {
        let ind = -1, len = 0; 
        this._state.vesselInfo.forEach( (item,index) => {if(item.centerline.length > len) ind = index;});
        return ind;
    }

    /** @param {string} vesselName */
    _initStenosisMarkup(vesselName) {
        //console.log('_initStenosisMarkup('+vesselName+'')
        if(this._setSelectedVessel(vesselName) == -1) {
            console.log('cannot find '+vesselName)
            return;
        }
        this._vesselList.selectOption(vesselName);

        let infoSpan = this.getElementByFragment(this.IdFragment.VESSELNAME);
        infoSpan.innerHTML = vesselName;

    }

    /*
     * @param {MouseEvent} e
     */
    _showStenosisInfo(e) {
        //console.log('_showStenosisInfo()')
        // если мы попали сюда по mouseover над colored box перед стеноз#, то сосед через одного справа
        // является элементом <input> типа "number", в котором можно найти уникальный ID стеноза
        const inputElement = e.target.nextSibling.nextSibling
        //console.log('inputElement.type',inputElement.type == 'number', inputElement.id)

        if(!this.infoDiv) {
            // width:200px; height:100px; 
            const style = 'position: absolute; border:1px solid black; padding:5px; background-color:lightyellow;'
            this.infoDiv = goog.dom.createDom("div",{"style": style});
            document.body.appendChild(this.infoDiv);

            // это попытка сделать CSS injection для infoDiv (да работает, или это называется dynamic CSS?)
            // то есть добавляется CSS class .hidden {'display': 'none'}
            var clearFloatStyle = goog.html.SafeStyleSheet.createRule('.hidden', {'display': 'none'});                          
            goog.style.installSafeStyleSheet(clearFloatStyle);
        }

        // Заполняем информацию о стенозе
        /////////////////////////////////

        if(inputElement.type == 'number') {
            const stenosis = this._state._stenosisList.find(el => el.percentId == inputElement.id) 
            const id = stenosis.id, name = stenosis.vessel.name
            const i0 = stenosis.tube.range[0], i1 =  stenosis.tube.range[1]
            const r0 = stenosis.vessel.profile[i0], Sfront = (Math.PI*r0*r0).toFixed(2)
            const r1 = stenosis.vessel.profile[i1], Srear = (Math.PI*r1*r1).toFixed(2)
            const front = _v(stenosis.vessel.centerline,stenosis.tube.range[0])
            const rear  = _v(stenosis.vessel.centerline,stenosis.tube.range[1]+1)
            const lenght = front.distanceTo(rear).toFixed(2)
            let info = `стеноз#${id}: "${name}"[${i0},${i1}]`; 
            info += `<br>S<sub>front</sub>=${Sfront} mm<sup>2</sup>`
            info += `S<sub>rear</sub>=${Srear} mm<sup>2</sup>`
            info += `<br>Длина ${lenght} mm`
            if(stenosis.UserStenosisPercent == -1) 
                info += '<br><b>не активен</b> (%% стеноза не указан)'       
            this.infoDiv.innerHTML = info;
            //console.log('XY',e.clientX,e.clientY)
            this.infoDiv.style.left = 15+e.clientX + 'px';
            this.infoDiv.style.top = -35+e.clientY + 'px';
        }

        d3.select(this.infoDiv).classed('hidden',false);
        //goog.style.setStyle(this.infoDiv,'display','block')
        //let d3card = d3.select(card); console.log('d3card',d3card)
        //card.innerHTML = `Стеноз#1 "right vessel 3"[82,84]`;
    }
    /*
     * @param {MouseEvent} e
     */
    _hideStenosisInfo(e) {
        //console.log('_hideStenosisInfo()')
        if(this.infoDiv) {
            // или так или так
            //goog.style.setStyle(this.infoDiv,'display','none')
             d3.select(this.infoDiv).classed('hidden',true);
        }
    }

   /** 
    * Общий обработчик для всех кнопок, checkbox'ов и других элементов управления, которые посылают MouseEvent
    * Сюда же приходят 'change' events от <input> элементов %% стеноза
    * а также нажатия кнопки delete справа от стеноза
    * 
    * @param {MouseEvent | Event} e 
    */
    _mouseEventHandler(e) {
        const fragId = this.getFragmentFromId(e.target.id);
        switch(fragId) {
            case this.IdFragment.CAPTURESTENOSOSBUTTON: this._buttonHandler__CaptureStenosis(); break;
            case this.IdFragment.STARTCALCULATIONBUTTON: this._buttonHandler__StartCalculation(); break;
            case this.IdFragment.CLEARLISTBUTTON: this._buttonHandler__ClearList(); break;
            case this.IdFragment.REFSTENOSIS: this._setReferenceStenosis(); break;
            default: 
                // ищем среди стенозов по полному e.target.id
                // (1) 'change' events от <input> элементов %% стеноза
                // (2) button delete рядом со стенозом
                let found = false;
                for(let stenosis of this._state._stenosisList) {
                    if(stenosis.percentId == e.target.id) {
                        stenosis.UserStenosisPercent = document.getElementById(e.target.id).value;
                        //console.log(`updated ${e.target.id} UserStenosisPercent with ${stenosis.UserStenosisPercent}`)
                        found = true;
                        break;
                    }
                    else if(stenosis.deleteId == e.target.id) {
                        this._buttonHandler__ClearStenosisListItem(stenosis)
                        const selectedVessel = this._state.vesselInfo[this._selectedCenterlineIndex]
                        this._vesselHistogramComponent && this._vesselHistogramComponent.buildHistogram(selectedVessel)
                        found = true;
                        break;
                    }
                }

                if(!found)
                    console.log('unknown fragment ID '+fragId);
        }

        this._manageButtonState();
    }

    _buttonHandler__CaptureStenosis() {
        //console.log('Button Capture stenosis pressed');
        // assert(this._selectedCenterlineIndex != -1)
        // палитра красного:
        let vessel = this._state.vesselInfo[this._selectedCenterlineIndex];

        // ищем первый свободный tube
        const tube = vessel.tubes.find(el => el.stenosis == null)
        if(!tube) return;

        //console.log(`найден tube range[${tube.range[0]},${tube.range[1]}]`)

        const palette = ['red', 'brown', 'orange']  
        const vesselColor = palette[this._stenosisCnt % palette.length]
        const stenosisNum = this._state._stenosisList.length+1;
        const listItemId = this._stenosisCnt++;
        const percentId = this.makeId('in')+'.'+listItemId;
        const deleteId = this.makeId('bd')+'.'+listItemId;

        let list = this.getElementByFragment(this.IdFragment.STENOSISLIST);
        
        let box = goog.dom.createDom("div",
            {"style": `width:10px; height:10px; background-color:${vesselColor}; margin-right:5px`, 
            "class": "goog-inline-block",
            });
            
        let item = goog.dom.createDom("div",{});
        let html = `Стеноз#${stenosisNum} 
        <input id="${percentId}" type="number" value="-1" style="width: 3em;"/>%`;
        html += `<button id="${deleteId}" style=" margin-left:10px">delete</button>`
        item.innerHTML = html;
        item.insertBefore(box,item.firstChild);

        list.appendChild(item); //console.log('item',item)
        //console.log('stenosis list', list)

        box.addEventListener('mouseover', e => this._showStenosisInfo(/** @type {MouseEvent}*/(e)));           
        box.addEventListener('mouseout', e => this._hideStenosisInfo(/** @type {MouseEvent}*/(e)));            

        tube.stenosis = {
            id:         stenosisNum,        // то что изображается после стеноз#
            vessel:     vessel,             // сосуд, на котором поставлен стеноз
            tube:       tube,     
            percentId:  percentId,          // ID <input> c %% стеноза 
            UserStenosisPercent: -1,        // то, что записано в <input>
            color: vesselColor,             // цвет назначается captureStenosis
            deleteId: deleteId,             // ID <button> delete
        }

        this._state._stenosisList.push(tube.stenosis);
        document.getElementById(percentId).addEventListener('change',e => this._mouseEventHandler(e)); 
        document.getElementById(deleteId).addEventListener('click',e => this._mouseEventHandler(e)); 
        this._vesselHistogramComponent && this._vesselHistogramComponent.buildHistogram(vessel)
        Tubes.colorTube(tube.mesh, tube.stenosis.color)
        return;
    }

    _buttonHandler__StartCalculation() {
        console.log('Button Start Calculation pressed',  this._state._stenosisList);
        this.prepareStenosisResult();
    }

    _buttonHandler__ClearStenosisListItem(stenosisItem) {
        // ListItem может быть идентифицирован по <input>.percentId или <button> delete id
        // в обоих случаях parent div - это то, что надо удалить из HTML STENOSISLIST
        // btnDelete.parentElement и parentNode оба указывают на div
        const btnDelete = document.getElementById(stenosisItem.deleteId)
        const itemListDiv = btnDelete.parentNode
        let list = this.getElementByFragment(this.IdFragment.STENOSISLIST);
        list.removeChild(itemListDiv)

        this.visArea.scene.remove(stenosisItem.tube.mesh);
        const indTube = stenosisItem.vessel.tubes.indexOf(stenosisItem.tube)
        if(indTube != -1)
            stenosisItem.vessel.tubes.splice(indTube,1)

        const indItem = this._state._stenosisList.indexOf(stenosisItem)
        if(indItem != -1)
           this._state._stenosisList.splice(indItem,1) 
    }

    _buttonHandler__ClearList() {
        //console.log('Button Clear List pressed');
        // TBD: оповестить VesselHistogramComponenet

        // очистить vessel.tubes[]
        //const vessels = []  // это сосуды на которых удаляли стенозы (можно с дубликатами)
        this._state._stenosisList.forEach(el => this._buttonHandler__ClearStenosisListItem(el))

        // (1) после последовательного удаления эдементов списка HTML STENOSISLIST не долже содержать divs
        let list = this.getElementByFragment(this.IdFragment.STENOSISLIST);
        let divs = []
        list.childNodes.forEach(element => {if(element instanceof HTMLDivElement) divs.push(element)})
        divs.forEach(d => list.removeChild(d))
        console.assert(divs.length == 0,'STENOSISLIST must be empty')

        // (2) список стенозов в state должен быть пустым
        console.assert(this._state._stenosisList.length == 0, 'список стенозов должен быть пустым')
        this._state._stenosisList = []

        // (3) в сосудах не должно быть tubes, помеченных как стеноз
        const no_st = this._state.vesselInfo.every(vessel => vessel.tubes.every(tube => tube.stenosis == null))
        console.assert(no_st,'в сосудах не должно быть tubes, помеченных как стеноз ')

        const selectedVessel = this._state.vesselInfo[this._selectedCenterlineIndex]
        this._vesselHistogramComponent && this._vesselHistogramComponent.buildHistogram(selectedVessel)
    }

    // управление доступностью кнопок 'Capture Stenosis', 'StartCalculation' и 'ClearList'
    // 'Capture Stenosis' пока доступна всегда, хотя она должна быть доступна, если есть хотя бы один
    // селектированный и пока не включеный в стеноз histogram bar, но это требует оповещения от 
    // HistogramComponent, поэтому пока отложу. То есть нажать 'Capture Stenosis' можно всегда, но если
    // содержательной работы нет, то она срабатывает как пустая кнопка
    // 'StartCalculation' активируется, если список стенозов непустой и, возможно, по некоторым дополнительным
    // условиям типа 'неотрицательный %% стеноза'
    // 'ClearList' доступна, если список стенозов непустой
    //
    _manageButtonState() {
        const startBtn = document.getElementById(this.makeId(this.IdFragment.STARTCALCULATIONBUTTON))
        const clearBtn = document.getElementById(this.makeId(this.IdFragment.CLEARLISTBUTTON));
        const captureBtn = document.getElementById(this.makeId(this.IdFragment.CAPTURESTENOSOSBUTTON));
        let validInputPcnt = true;  // все <input> %% стеноза отличны от -1
        this._state._stenosisList.forEach(s => validInputPcnt = validInputPcnt & (s.UserStenosisPercent >= 0))
        const selectedVessel = this._state.vesselInfo[this._selectedCenterlineIndex];
        const freeTube = selectedVessel.tubes && selectedVessel.tubes.find(el => el.stenosis == null)

        startBtn.disabled = (this._state._stenosisList.length == 0 || !validInputPcnt);
        clearBtn.disabled = (this._state._stenosisList.length == 0);
        captureBtn.disabled = !freeTube;
    }

//------------------------Handlers: (конец)
    
  /**
   * Сюда приходит управление, когда сдвигается левый или правый конец слайдера
   * При сдвиге левого конца, extent тоже меняется, хотя value + extent остается неизменым
   */
  _markerRangeChanged() {
    // console.log('_markerRangeChanged()');
    const value = this.twoThumbSlider.getValue(), opacity = parseInt(value) / 100;
    //console.log('LCA mesh',this._state.vesselsObj.LCA.mesh)
    this._state.vesselsObj.LCA.mesh['material'].opacity = opacity;
    // console.log('RCA mesh.material',this._state.vesselsObj.RCA.mesh.material)
    this._state.vesselsObj.RCA.mesh['material'].opacity = opacity;
  }

// cube.geometry() возвращает THREE.BufferGeometry и это существенно для раскраски сосудов значением ФРК
// однако маркировка стеноза использует THREE.Geometry, которая возвращается smoothMesh
// надо уходить от THREE.Geometry, так как она стала depricated в THREE r.125, но при этом надо решить
// вопро со сглаживанием аорты и сосудов
// THREE.Geometry явно используется в Axplane.sliceGeometry() Для получения сечения плоскостью

  // пока только для v1Mesh
  makeVesselMesh(vObj) {
    // console.log('makeVesselMesh(vObj)');
    const vesselColor = new THREE.Color(vObj.color);
    const r = vesselColor.r*255, g = vesselColor.g*255, b=vesselColor.b*255;
    let geometry = vObj.cube.geometry();
    const position = geometry.getAttribute( 'position' );// console.log('position',position)
    //const positions = position.array;
    const vertsNum = position.count;
    //let colors0 = new Float32Array(vertsNum*3)
    let colors0 = new Uint8Array(vertsNum*3)
    for(var  i=0; i<vertsNum; i++) {
        colors0[3*i+0] = r//vesselColor.r; // если colors Float32Array-
        colors0[3*i+1] = g//vesselColor.g; 
        colors0[3*i+2] = b//vesselColor.b; 
    }

    //geometry.addAttribute( 'color', new THREE.BufferAttribute( colors0, 3 ) );
    geometry.addAttribute( 'color', new THREE.BufferAttribute( colors0, 3, true ) );    // true - normalize?

    vObj.mesh = new THREE.Mesh(geometry, 
      new THREE.MeshLambertMaterial( { 
        //color: 0xd28e0c, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.2,
        'vertexColors': THREE.VertexColors, //THREE.FaceColors
        }));

    vObj.mesh.applyMatrix(this._stack.ijk2LPS);
    return vObj.mesh;
  }

  start(state) {
    // state={stack,aortaCube,[v0Cube,v1Cube], vesselInfo=[name,burificationPoints[],centerline[]]}
    // vesselInfo.push({name:state4[3*i], burificationPoints:state4[3*i+1].data, centerline:state4[3*i+2].data})
    // console.log('MarkStenosis::start() vessels '+state.vessels.length+' vesselInfo '+state.vesselInfo.length)

    this._stack = state.stack;
    const vesselInfo = state.vesselInfo;

    this.tabbar.setSelectedTabIndex(this._myTabIndex);

    let IJK2LPS = this._stack.ijk2LPS;
    let aortaMesh = new THREE.Mesh(state.aortaCube.geometry(), 
      new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide }));
    this.aortaMesh = aortaMesh;
    aortaMesh.applyMatrix(IJK2LPS);
    this.makeVesselMesh(this._state.vesselsObj.LCA);;
    this.makeVesselMesh(this._state.vesselsObj.RCA);

    // пора классифицировать сосуды как LCA или RCA
    // boundingBox в mesh записан в координатах IJK, а centerline в мировых координатах
    // начальные точки центральной линии сосуда вполне могут лежать сразу в обоих boundingBox
    // (проверено на Почукаевой). Значительно более точную оценку дает последняя точка центральной линии.
    // Однако у Почукаевой 'Left vessel: 1' целиком лежит в обоих boundingBox - LCA и RCA.
    // В этом случае классификация идет по наличию в имени 'Left vessel:'

    const bboxLCA = this._state.vesselsObj.LCA.mesh.geometry.boundingBox.clone().applyMatrix4(IJK2LPS);
    const bboxRCA = this._state.vesselsObj.RCA.mesh.geometry.boundingBox.clone().applyMatrix4(IJK2LPS);
    const bxb = bboxLCA.clone().intersect(bboxRCA)
    for(let i=0; i<this._state.vesselInfo.length; i++) {
        // if(i != 4) continue;
        const name = this._state.vesselInfo[i].name;
        let line = this._state.vesselInfo[i].centerline, ind = line.length/3-1;
        let p = new THREE.Vector3(line[3*ind],line[3*ind+1],line[3*ind+2])
        let inL = bboxLCA.containsPoint(p), inR = bboxRCA.containsPoint(p);
        // console.log(`${name} p[${ind}] in LCA&RCA`,inL, inR)
        if(inL == inR) {
            // классифицирем по имени
            inL = name.includes('Left vessel:'); inR = !inL;
            console.warn(`${name} classified by name as `,(inL ? 'LCA' : 'RCA'))
        }
        else {
            let matched = name.includes('Left vessel:') && inL || name.includes('Right vessel:') && inR;
            if(!matched)
                console.warn(`${name} was classified by geometry as `,(inL ? 'LCA' : 'RCA'));
        }

        this._state.vesselInfo[i].artery = (inL ? this._state.vesselsObj.LCA : this._state.vesselsObj.RCA)
    }

    this.enableVisArea();
    //this.visArea.scene.add(this.smoothMesh(aortaMesh,0));
    this.visArea.scene.add(this.aortaMesh);
    this.visArea.scene.add(this._state.vesselsObj.LCA.mesh);
    this.visArea.scene.add(this._state.vesselsObj.RCA.mesh);
    let centerLPS = this._stack.worldCenter();
    this.visArea.camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
    this.visArea.camera.zoom = 5;
    this.visArea.camera.updateProjectionMatrix();
    this.visArea.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);

    // пересчитываем центральные линии сосудов и создаем mesh для каждой и добавляем к сцене
    // и формируем массив имен сосудов для передачи в компонент списка
    // почему-то в именах сосудов присутствуют '\n' в конце, в этом случае их обрезаем
    let vesselNames = [];
    for(let v=0; v<vesselInfo.length; v++) {
        let name = vesselInfo[v].name;
        if(name.endsWith('\n')) {
            name = name.slice(0,-1);
            vesselInfo[v].name = name;
        }
        vesselNames.push(vesselInfo[v].name);
        var geometry = new THREE.BufferGeometry();
        let data = vesselInfo[v].centerline;
        // Float64Array[] -> Float32Array[]
        let positions = new Float32Array(data.length);
        for(let i=0; i<data.length; i++)
          positions[i] = data[i];
        vesselInfo[v].centerline = positions;
        var numPoints = positions.length/3;
        geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
        let object = new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xffffff } ) );
        object.visible = false;
        vesselInfo[v].centerlineMesh = object;
        this.visArea.scene.add(vesselInfo[v].centerlineMesh);
    }

    // заполняем список сосудом актуальными данными
    this._vesselList.add(vesselNames);

  }

  enableVisArea() {
    // console.log('enableVisArea()')
    let visRef = $("r0").parentNode;
    if(!UP3.isEnabled(visRef)) {
        $("r0").style.display="none";
        $("r1").style.display="none";
        $("r2").style.display="none";
        $("r3").style.display="none";

        this.visArea = UP3.enable(visRef);
        UP3.initRenderer3D(visRef);
        // Стандартный renderer из UP3 не подойдет, 
        // так как при маркировке стеноза используется экран в экране и виртуальная эндоскопия
        // UP3.render(visRef);    
    }
    else {
        UP3.stopRender(visRef);
       this.visArea = UP3.getEnabledElement(visRef,true); 
    }
  }

    // Специальный рендеринг visArea: экран в экране
    //
  startRendering() {
    const visArea = this.visArea;
    const scene = visArea.scene, camera = visArea.camera, stack = this._stack;
    //const scene2 = visArea.scene2, camera2 = visArea.camera2;
    const controls = visArea.controls, renderer = visArea.renderer;

    // это Брусницин
    if(stack['_dimensionsIJK'].z == 640) {
        console.log('установить положение камеры для Брусницина')
        camera.position.x = 339;
        camera.position.y = -636;
        camera.position.z = 785;
    }

    // var helper0 = new THREE.CameraHelper(rightOrto.camera)
    // scene.add(helper0); 
    // console.log('scene.light',visArea.light.position, visArea.light.target.position)

    // чтобы направить DirectionalLight надо
    // 1) установить light.position 2) light.target.position 3) scene.add(light) 4) scene.add(light.target)
    // 5) light.target.updateMatrixWorld(); 6) (если есть) lightHelper.update();
    // пункты 4-5-6 вообще неочевидны
    //
    let worldbb = stack.worldBoundingBox(); //[xmin,xmax,ymin,ymax,zmin,zmax];
    const pointUR = new THREE.Vector3(worldbb[1],worldbb[3],worldbb[5]);
    const pointLL = new THREE.Vector3(worldbb[0],worldbb[2],worldbb[4]);
    let centerLPS = this._stack.worldCenter();

    visArea.light.position.copy(pointUR); 
    visArea.light.target.position.copy(centerLPS); 
    scene.add(visArea.light.target);
    visArea.light.target.updateMatrixWorld();

    // let lightHelper = new THREE.DirectionalLightHelper(visArea.light);
    // scene.add(lightHelper);
    // lightHelper.update();

    // эксперименты со светом: добавим еще свет в левый нижний угол
    //-------------------------------------------------------------
    let lightLL = new THREE.DirectionalLight(0xffffff, 1);
    lightLL.position.copy(pointLL); 
    lightLL.target.position.copy(centerLPS); 
    scene.add(lightLL.target);
    lightLL.target.updateMatrixWorld();
    //scene.add(lightLL)

    // let lightHelperLL = new THREE.DirectionalLightHelper(lightLL);
    // scene.add(lightHelperLL);
    // lightHelperLL.update();

    // Создаем точечный источник света
    var pointLight = new THREE.PointLight(0xffffff,10);
    pointLight.position.set(centerLPS.x,centerLPS.y,centerLPS.z);
    // pointLight.position.set(0,0,0);
    //scene.add(pointLight);

    // const pointLightHelper = new THREE.PointLightHelper(pointLight, 1);
    // scene.add(pointLightHelper);
    //---------------------------

    // scene.add(new THREE.AxisHelper(100));

    // при начальной установке маркера должен сработать EventListener, который только что был установлен
    // debugger;
    this.twoThumbSlider.setValueAndExtent(40,20);

    let testInfoDiv = this.getElementByFragment(this.IdFragment.TESTINFODIV);   // это эксперименты со светом

    //UP3.render(visArea.domElement);

        function render() {
          requestAnimationFrame(render);

          controls.update();

          visArea.light.position.copy(camera.position); 
          //lightHelper.update();

          renderer.clear();
          renderer.render(scene, camera);

          if(visArea.scene2) {
            renderer.autoClear = false;
            //renderer.clearDepth();
            renderer.render( visArea.scene2, visArea.camera2 );
          }
        }

        console.log('starting my render()')
        render();

  }

  /**
   * Это эксперименты по виртуальной эндоскопии,
   * когда камера помещена внутрь сосуда и движется по его центральной линнии
   * @param {string} vesselName
   */
  _virtualEndoscopy(vesselName) {
      console.log(`MarkStenosisComponent::_virtualEndoscopy(${vesselName})`);

      let self = this;

      // в нижней чвсти сплиттера будем рендерить виртуальную эндоскопию
      // для этого сначала погасим VesselList
      this._vesselList.setVisible(false);
      let mySize = this.lhsSize; mySize.width += 0; // хак
      this._vspl.setSize(mySize,mySize.height*0.40);
      let comp2Content = this._vspl.getChildAt(1).getContentElement();  
      comp2Content.style.height = '100%';
      comp2Content.style.overflow='hidden';

      let tab1 = /** @type {goog.ui.Tab} */ (this.tabbar.tabBar.getChildAt(1));
      tab1.setVisible(true); //tab1.setEnabled(false);     
      this.tabbar.setSelectedTabIndex(1);

      this._ve_cameraSlider.slider.setValue(50);
        
/*
        // Сосуд: <b><span id="${this.makeId(this.IdFragment.VESSELNAME)}"></span></b>
        // let letfArrowID = this.makeId('ms-4');
        // let rightArrowID = this.makeId('ms-5');

        var tab1HTML_ = 
        `<div>
            <div style="display:flex; width:100%;">
                <span id="${this.makeId('hh-1')}" title="маркер влево">◀</span> 
                <div id="${this.makeId('hh-2')}" style="min-width:20px; height: 20px;  flex-grow:2;"></div>
                <span id="${this.makeId('hh-3')}" title="маркер вправо">▶</span>
            </div>
            <br>Управление фокусом камеры <span id="${letfArrowID}" title="фокус влево">◀</span>
            <span id="${rightArrowID}" title="фокус вправо">▶</span>
        </div>`;
        
        // this.getElementByFragment('hh-3').addEventListener('click', e => this.r4.controls.next());
        // this.getElementByFragment('hh-1').addEventListener('click', e => this.r4.controls.prev());

*/
      const visArea = this.visArea, scene = visArea.scene, camera = visArea.camera, stack = this._stack;
      this.r4 = UP3.enable(comp2Content)
      UP3.initRenderer3D(comp2Content);
      // console.log('comp2Content',comp2Content);

      // AxplaneControl ведет камеру по centerline стрелками влево и вправо
      // и фокусирует ее на 2 точки вперед по центральной линии
      //
      let positions = this._state.vesselInfo[this._selectedCenterlineIndex].centerline;
      this.r4.controls = new AxplaneControls(this.r4.camera, this.r4.domElement, positions);

      let myv1Mesh = this._state.vesselsObj.RCA.mesh.clone(); //myv1Mesh.material.opacity = 1;
      let smoothFactor = 0;
      this.r4.scene.add(myv1Mesh);

      var helper0 = new THREE.CameraHelper(this.r4.camera)
      scene.add(helper0); this.cameraHelperR4 = helper0;      
      scene.add(new THREE.AxisHelper(100));
      // scene.remove(r0.light)     
      // scene.add(this.r4.controls.axplane);
      // let centerLPS = this._stack.worldCenter(), axPosition = this.r4.controls.position;
      // this.addSphereAtPoint(scene,centerLPS)

      // this.r4.light = new THREE.PointLight(0xffffff, 1);
      // this.r4.scene.add(this.r4.light);
      // scene.remove(visArea.light);

      // Опции: DirectionalLight PointLight SpotLight
      // DirectionalLight
      if(false) {
        this.r4.light = new THREE.DirectionalLight(0xffffff, 1);
        let pTarg = this.r4.controls.point(this.r4.controls.ptInd+2);
        // this.r4.light.position.copy(this.r4.camera.position);
        // this.r4.light.target.position.copy(pTarg);
        this.r4.light.position.copy(pTarg);
        this.r4.light.target.position.copy(this.r4.camera.position);
          this.r4.scene.add(this.r4.light.target);
          this.r4.light.target.updateMatrixWorld();
      }

      // 
      this.r4.light = new THREE.SpotLight(0xffffff, 1)
      this.r4.light.position.copy(this.r4.camera.position);
      this.r4.scene.add(this.r4.light);
      this.r4.light.target.position.copy(this.r4.controls.point(this.r4.controls.ptInd+2));
      this.r4.scene.add(this.r4.light.target);

      // const helper1 = new THREE.DirectionalLightHelper(this.r4.light);
      // helper1.update();
      // scene.add(helper1);

      console.log('near/far',this.r4.camera.near,this.r4.camera.far)
      let pTargInd = this.r4.controls.ptInd+2;
      
      this.r4.domElement.addEventListener('click', (e) => {
        let pTarg = this.r4.controls.point(pTargInd++);
        this.r4.light.position.copy(pTarg);
        console.log('pTarg',pTarg)
        // this.r4.camera.near += 1;
        // this.r4.camera.far += 1;
        // console.log('near/far',this.r4.camera.near,this.r4.camera.far) 
        // this.r4.domElement.style.display='none';
      });

      // управление камерой
      this._ve_cameraSlider.slider.addEventListener(goog.ui.Component.EventType.CHANGE, () => {
        const value = this._ve_cameraSlider.getValue();
        // console.log('VE_CAMERA change '+value)
        this.r4.controls.setRelativePosition(value);
      });      


      this.getElementByFragment(this.IdFragment.VE_BUTTON_SMOOTH).addEventListener('click', 
        e => {
            // this._mouseEventHandler(/** @type {MouseEvent}*/(e))
            smoothFactor++;
            console.log(`clicked button SMOOTH (factor will be ${smoothFactor})`);
            console.log('myv1Mesh',myv1Mesh);
            const f0=0,v0=0;
            let smoothedMesh = this.smoothMesh(this._state.vesselsObj.RCA.mesh, smoothFactor) 
            this.r4.scene.remove(myv1Mesh);
            this.r4.scene.add(smoothedMesh); myv1Mesh = smoothedMesh;
            const f1 = smoothedMesh.geometry.faces.length, v1 = smoothedMesh.geometry.vertices.length;
            console.log(`Было ${f0}/${v0} граней/вершин Стало ${f1}/${v1}`)
        });

      function animate() {
        requestAnimationFrame(animate);
        self.r4.controls.update();
        helper0.update();
        // let pTarg = self.r4.controls.point(self.r4.controls.ptInd+2);
        self.r4.light.position.copy(self.r4.camera.position);
        self.r4.renderer.render(self.r4.scene, self.r4.camera);
        // cameraInfo(huv);
      }

      // console.log('start animation R4')
      animate();
  }

  async prepareStenosisResult() {
    if(!this._state._stenosisList.length) return;

    let sList = [];
    for(let st of this._state._stenosisList) {
        const front = _v(st.vessel.centerline,st.tube.range[0])
        const rear  = _v(st.vessel.centerline,st.tube.range[1])
        sList.push({frontPos:front, rearPos:rear, UserStenosisPercent:st.UserStenosisPercent})

        // перед запуском расчета делаем все меши стенозов невидимыми
        // чтобы они не портили картину в раскрашенных трубках FFR (PlasticBoy)
        //
        console.log(`делаю невидимым меш в диапазоне [${st.tube.range[0]}, ${st.tube.range[1]}]`)
        st.tube.mesh.visible = false;
    }
    const t0 = performance.now();
    console.log ('prepareStenosisResult() список стенозов', sList);

    // Psys (mmHg), Pdia (mmHG), SV (ml), HR (bpm)
    const Psys = document.getElementById('Psys').value;
    const Pdia = document.getElementById('Pdia').value;
    const SV = document.getElementById('SV').value;
    const HR = document.getElementById('HR').value;
    console.log('ЧСС',[Psys,Pdia,SV,HR])

    const value = await FFR.viewer._FFRsrv.PrepareResultBinary(sList, [Psys,Pdia,SV,HR], e => {
      FFR.viewer._ffrDriver.showProgress(e)
    });

    const durationSec = (performance.now() - t0) / 1000;
    const qmin = Math.floor(durationSec/60), qsec = Math.floor(durationSec % 60);
    const durationStr = ''+qmin+' мин '+ qsec + ' сек';
    let msg;

    if(typeof value === 'string') {
        this._FFRvalue = undefined;
        msg = 'расчет завершился аварийно:   '+ value;
    }
    else {
        this._FFRvalue = value;
        msg = 'FFR value '+ this._FFRvalue;
        msg += '\n'+'Время выполнения: '+ durationStr;
        alert(msg);
        new PlasticBoy(this._state, this.visArea).colorTubesByFFR()
    }
  }

  smoothMesh(mesh, subdivisions) {
    let modifier = new SubdivisionModifier(subdivisions);
    let smoothGeom = modifier.modify(mesh.geometry);    
    let smoothMat = mesh['material'].clone();
    let smoothMesh = new THREE.Mesh(smoothGeom,smoothMat)
    smoothMesh.applyMatrix(this._stack.ijk2LPS);
    //const f0 = mesh.geometry.faces.length, v0 = mesh.geometry.vertices.length;
    const f0 = 0, v0 = 0;
    const f1 = smoothMesh.geometry.faces.length, v1 = smoothMesh.geometry.vertices.length;
    //console.log(`Было ${f0}/${v0} граней/вершин Стало ${f1}/${v1}`)
    return  smoothMesh;
  }

//------------------------Это пришло из MarkStenosis (конец)

    _setReferenceStenosis() {
        // console.log('setReferenceStenosis()')
        const chbox = document.getElementById(this.makeId(this.IdFragment.REFSTENOSIS));
        //console.log(chbox, chbox.checked)
        this.aortaMesh.visible = chbox.checked;
        console.log('camera position',this.visArea.camera.position)        
    }

  /**
   * Vessel Histogram Component setter
   *
   * @param {*} vesselHistogram
   */
  set vesselHistogramComponent(vesselHistogram) {
    this._vesselHistogramComponent = vesselHistogram;
    if(this._selectedCenterlineIndex != -1)
        this._vesselHistogramComponent.setSelectedVessel(this._selectedCenterlineIndex)
  }

}

 function makeSphereAtPoint(point, rad) {
  var sphereGeometry = new THREE.SphereGeometry( rad, 32, 16 );
  var faceColorMaterial = new THREE.MeshBasicMaterial({color:0xffffff});
  var sphere = new THREE.Mesh( sphereGeometry, faceColorMaterial );
  sphere.position.set(point.x, point.y, point.z);
  return sphere;
}

 function makeBoxAtPoint(point, side) {
    const options = {color:0xffffff,/* transparent: true, opacity: 0.5, side: THREE.DoubleSide,*/}
    var sphereGeometry = new THREE.BoxGeometry( side, side, side );
    var faceColorMaterial = new THREE.MeshBasicMaterial(options); // MeshBasicMaterial MeshLambertMaterial
    var sphere = new THREE.Mesh( sphereGeometry, faceColorMaterial );
    sphere.position.set(point.x, point.y, point.z);
    return sphere;
}

function printVesselInfo(vinfo) {
    let inf = []
    for(let v of vinfo) {
        const cpts = v.centerline.length/3, bpts = v.burificationPoints.length / 3
        const msg = `${v.name}: centernine pts ${cpts} burification points ${bpts}`
        //console.log(msg)
        inf.push({name:v.name, c:cpts, b:bpts})
    }
    console.table(inf)
    console.log(vinfo)
}

FFR.ui.MarkStenosisComponent = MarkStenosisComponent;
  

