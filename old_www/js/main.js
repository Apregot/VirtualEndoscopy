goog.require('goog.object');
goog.require('goog.dom');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.Menu');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.SubMenu');
goog.require('goog.ui.MenuSeparator');
goog.require('goog.ui.ToolbarMenuButton');
goog.require('goog.ui.ToolbarButton');
goog.require('goog.ui.Component');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('goog.style');

goog.require('gfk.ui.Dialog');
goog.require('goog.ui.SplitPane');
goog.require('gfk.ui.SplitPane');
goog.require('gfk.ui.SplitPaneExpanded');
goog.require('gfk.ui.TabBar');
goog.require('gfk.ui.ProgressBar');

/* Пространство имен приложения FFR
 */
var FFR = FFR || {};
FFR.ui = {};
FFR.ui.events = {};

FFR.viewer = null;
// export
window['FFR'] = FFR;

FFR.createViewer = function (parent) {
    //const date = new Date(); console.log(date.toLocaleString());    // 07.10.2021, 15:46:53
    document.title = `V5-FFR Viewer build ${AppConfig.build}`;
    var mainwin = goog.dom.createDom("div",{"class": "ffr-viewer-main"});
    parent.appendChild(mainwin);
    FFR.viewer = new Viewer(mainwin);
}
FFR['createViewer'] = FFR.createViewer;

class MyComponentResized extends goog.ui.Component {
    constructor() {
        super();
    }
    resize() {
        // console.log('MyComponentResized::resize()');
        this.forEachChild(child => child.resize());
    }
}
/**
 * Класс FFR.Viewer
 * constructor onResize onDoubleClickR0 onRightSplitpaneHandleDrug
 * createToolbar
 * processToolbarAction_
 * loadAortaMask(file) file={File|Blob} - вызывается в ffrdriver.js
 * showInfoMessage(message)
 */
class Viewer {

    constructor(mainwin) {
        console.log("constructor Viewer");
        // запрашиваем автоматичекий запуск сервиса ATB. 

        // Подключение будет позже
        //
        this.serviceRequest();

        let self = this;
        this._about = `Версия ${AppConfig.version}.${AppConfig.build}\nот ${AppConfig.date} `;

        this.mainwin = mainwin;  
        this._wsurl = AppConfig.wsurl; //'ws://192.168.50.138:80';
        //this._wsurl_remote = 'ws://dodo.inm.ras.ru/websocket';
        this._semafor = null;
        this._menuItemMarkStenosis = null;
        this.toolbar = this.createToolbar();
        this.markStenosis = null;

        // это теперь управляется {open|close}Series
        this._FFRsrv        = null;   
        this._ffrDriver     = null;      

        var splitmain = goog.dom.createDom("div", {});
        var container = goog.dom.createDom("div", {"class": "container", "id": "container"});
        var stage = goog.dom.createDom("div",{"class": "ffr-viewer-stage"}, container);
        this.mainwin.appendChild(stage);

        //new goog.ui.Button('hello'); 
        this._quadview = new QuadView(this);
        this.leftPanel = new LeftPanelComponent(this);
        let btmPlaceholderComponent = new MyComponentResized() //new goog.ui.Component();//new SeriesListsComponent();
        this.seriesLists = new SeriesListsComponent(); //  new VesselHistogramComponent();
        // gfk.ui.SplitPaneExpanded goog.ui.SplitPane
        this._vspr = new gfk.ui.SplitPaneExpanded(this._quadview,btmPlaceholderComponent,goog.ui.SplitPane.Orientation.VERTICAL)
        // btmPlaceholderComponent.getElement().style.height = "99%";
        btmPlaceholderComponent.addChild(this.seriesLists,true);
        // new goog.ui.Component()   new MyComponentResized()
        this._mainSplitControl = new goog.ui.SplitPane(new MyComponentResized(),this._vspr, goog.ui.SplitPane.Orientation.HORIZONTAL);
        this._mainSplitControl.getChildAt(0).addChild(this.leftPanel,true);
        this._mainSplitControl.render(container);
        this._mainSplitControl.getChildAt(0).getElement().style.height = '100%';    // это важно
        this._mainSplitControl.setFirstComponentSize(350);  // на глаз
        this._vspr.setFirstComponentSize(450);

        this.markStenosisComponent = null
        this.vesselHistogramComponent = null

        // goog.events.listen(vspr.splitpane, goog.ui.Component.EventType.CHANGE, e => this.onRightSplitpaneHandleDrug(e)); 

        window.addEventListener('resize',()=>this.onResize());

    }

    serviceRequest() {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", "service.php?c=start",false);   // sync
        xhr.onload = function() {
            console.log('service.php onload()');
            console.log('получили '+xhr.response.length+' байт');
            //console.log(xhr.response);
        }
        xhr.onerror = function() {
            console.log('service.php onerror()');
        }

        console.log('sending service.php request start service')

        xhr.send();
    }

    processMarkStenosis(state) {
        // скрываем левую панель
        this._mainSplitControl.getChildAt(0).removeChild(this.leftPanel,true)   // альтернатива setVisible(false)

        // устанавливаем вместо нее MarkStenosisComponent
        let MarkStenosisComponentRef = new MarkStenosisComponent(null /*lhsSize*/, state);
        this.markStenosisComponent = MarkStenosisComponentRef;
        this._mainSplitControl.getChildAt(0).addChild(MarkStenosisComponentRef,true)

        // VesselHistogramComponent на месте SeriesLists
        //
        this.seriesLists.setVisible(false);
        this._vspr.getChildAt(1).removeChildAt(0);
        this.vesselHistogramComponent = new VesselHistogramComponent(MarkStenosisComponentRef);
        this._vspr.getChildAt(1).addChild(this.vesselHistogramComponent,true);

    }

    onResize() {
      let stage = document.getElementsByClassName('ffr-viewer-stage')[0];
      // logElementSize(stage)
      let size = goog.style.getSize(stage);
      // console.log('onResize()',size);
      this._mainSplitControl.setSize(size);
      // this._vspr.fitParent();        // это из прошлой жизни
    }

    onDoubleClickR0(e) {
      console.log('onDoubleClickR0()',e)
    }


    /**
     * FFR.Viewer.onRightSplitpaneHandleDrug()   - обработчик handle правой splitpane
     * return: goog.ui.Toolbar
     */
    onRightSplitpaneHandleDrug(e) {
      console.log('onRightSplitpaneHandleDrug()'/*, e.target*/);
    }

	/**
     * FFR.Viewer.createToolbar()
     * return: goog.ui.Toolbar
     */
    createToolbar()  {

        var t1 = new goog.ui.Toolbar();
        var self = this;

        // добавляем menuButton File
        var fileMenu = new goog.ui.Menu();
        let inputIdFile = t1.makeId('inpf'); 
        let ee =[
            goog.dom.createDom(goog.dom.TagName.INPUT, {
                id: inputIdFile,
                type: goog.dom.InputType.FILE,
                'class': 'inputfile-invisible',
              }),
            goog.dom.createDom(goog.dom.TagName.LABEL, {for:inputIdFile}, 'Чтение DICOM файла')];
        fileMenu.addItem(new goog.ui.MenuItem(ee));

        let inputId = t1.makeId('inpd'); 
        ee =[goog.dom.createDom("div","goog-menuitem-icon","📂"),
            goog.dom.createDom(goog.dom.TagName.INPUT, {
                id: inputId,
                type: goog.dom.InputType.FILE,
                'class': 'inputfile-invisible',
                'webkitdirectory':' ', 
              }),
            goog.dom.createDom("div","goog-menuitem-accel","Ctrl+F2"),
            goog.dom.createDom(goog.dom.TagName.LABEL, {for:inputId}, 'Чтение DICOM каталога')];
        fileMenu.addItem(new goog.ui.MenuItem(ee));

        var btnFile = new goog.ui.ToolbarMenuButton('Файл',fileMenu);
        btnFile.setTooltip('Тесты диалогов');
        t1.addChild(btnFile,true);

        // добавляем в меню Инструменты
        var toolsMenu = new goog.ui.Menu();
        toolsMenu.addItem(this._menuItemMarkStenosis = new goog.ui.MenuItem('Маркировка стеноза'));
        self._menuItemMarkStenosis.setEnabled(false);


        var btnTools = new goog.ui.ToolbarMenuButton('Инструменты',toolsMenu);
        btnTools.setTooltip('Инструменты ФРК');
        t1.addChild(btnTools,true);

        // добавляем в меню Тесты
        var testsMenu = new goog.ui.Menu();

        var regMenu = new goog.ui.SubMenu("Регрессионные тесты");
        regMenu.addItem(new goog.ui.MenuItem('Почукаева-113'));
        regMenu.addItem(new goog.ui.MenuSeparator());
        regMenu.addItem(new goog.ui.MenuItem('debug test'));
        // regMenu.addItem(new goog.ui.MenuItem('Домаскин'));
        // regMenu.addItem(new goog.ui.MenuItem('Завьялова'));
        testsMenu.addItem(regMenu);

        testsMenu.addItem(this._menuItemLWSTests = new goog.ui.MenuItem('lws tests'));
        this._menuItemLWSTests.setEnabled(false);
        testsMenu.addItem(this._menuItemSvetz = new goog.ui.MenuItem('test load svetz-190'));
        this._menuItemSvetz.setEnabled(false);
        var btnTests = new goog.ui.ToolbarMenuButton('Тесты',testsMenu);
        btnTests.setTooltip('Тесты LWS');
        t1.addChild(btnTests,true);

        var btnAbout = new goog.ui.ToolbarMenuButton('О программе');
        btnAbout.setTooltip(this._about);
        //btnAbout.setEnabled(false);
        t1.addChild(btnAbout,true);        

        this._semafor= new goog.ui.ToolbarButton("🔴");
        this._semafor.setTooltip(`FFR сервер @${this._wsurl} не подключен`);
        t1.addChild(this._semafor,true);

        t1.render(this.mainwin);
        // прокси-функция, которая передает правильный контекст this в processAction()
        function processAction(e) {
            self.processToolbarAction_(e);
        }
        goog.events.listen(btnFile, 'action', processAction);
        goog.events.listen(btnTools, 'action', processAction);
        goog.events.listen(btnTests, 'action', processAction);

        var t1Element = t1.getElement();
        t1Element.className = "ffr-viewer-toolbar";
        t1Element.style.display="block";
        t1Element.removeAttribute("role");
        t1Element.removeAttribute("tabindex");

        return t1;
    }   // end createToolbar

    /**
     * FFR.Viewer.processToolbarAction_()
     * @param {goog.events.Event} e
     * @private
     */
    // e.target instanceof goog.ui.ToolbarToggleButton
    // e.target === btnInfo
    // e.target.getCaption() == "Инфо"
    // e.target.getContent() возвращает DOM <div class="V5-toolbar-button">
    //console.log('btnMenu.action event=');
    // e.type=="action" e.{altKey|ctrlKey|shiftKey|metaKey}
    // e.target=goog.ui.menuItem - значит доступны все его методы
    // e.target.getContent() === "Текст"

    processToolbarAction_(e)  {
        let cap = e.target.getCaption()
        const parentCap = e.target.getParent().parent_.content_   // химия
        console.log(cap);

        if(cap === 'Маркировка стеноза') {
            // это имитация маркировки стеноза с предварительной загрузкой state4
            const self = this;
            async function __markStenosisWithLoadState4() {

                console.log('Автоматический тест Почукаева-113')
                const _FFRsrv = FFR.viewer._FFRsrv
                const files = ['http://localhost/~germank/IM1']
                let loader = new AMI.VolumeLoader(/*container, CustomProgressBar*/);
                console.log(`загружаем DICOM ${files[0]}`)
                await loader.load(files)

                let series = loader.data[0].mergeSeries(loader.data)[0];
                console.log('прореживаем серию до 200 срезов' )
                let thinSeries = FFR.viewer.seriesLists.seriesThinOut(series,200);    // до 200 срезов
                //_seriesFingerprint(thinSeries); return
                console.log('добавляем серию в список и загружаем в QuadView' )
                FFR.viewer.seriesLists.addNewSeries(thinSeries);
                FFR.viewer._quadview.loadSeries(thinSeries);

                let state4 = await self._FFRsrv.sendRequestFSF("test load state4");
                //console.log('state4',state4)
                let aortaCube = new Cube(state4[0],'aorta'), 
                    v0Cube = new Cube(state4[1],'vessel0'), 
                    v1Cube = new Cube(state4[2],'vessel1');

                // почему-то в конце state4 находится null, поэтому length-1
                const vesselsCnt = (state4.length-1)/3 - 1;
                //console.log(`число сосудов в state4 ${vesselsCnt}`)
                let vesselInfo = [];
                for(var i=1; i<=vesselsCnt; i++) {
                    vesselInfo.push({name:state4[3*i], burificationPoints:state4[3*i+1].data, centerline:state4[3*i+2].data})
                }

                aortaCube.compress(); v0Cube.compress(); v1Cube.compress();      
                let state4Obj={stack:self._quadview._series.stack[0], 
                    aortaCube:aortaCube, 
                    vessels: [v0Cube,v1Cube], 
                    vesselInfo: vesselInfo,
                };

                self.processMarkStenosis(state4Obj)
            }
            
            __markStenosisWithLoadState4();

        }
        else if(cap.indexOf('Чтение DICOM каталога') !== -1 || (cap === 'Чтение DICOM файла')) {
          let inputFile = e.target.getElementByClass('inputfile-invisible');
          const self = this;
          let onChange = function(e) {  // не может быть лямбда функцией потому, что надо делать removeEventListener
            inputFile.removeEventListener('change', onChange);
            handler__loadDICOMFileOrDir(e.target.files);
            // https://stackoverflow.com/questions/19643265/second-use-of-input-file-doesnt-trigger-onchange-anymore
            e.target.value = ''
          }
          inputFile.addEventListener('change', onChange);
        }

        /// Меню Tесты
        ///
        else if(cap === 'lws tests') {
          //window.location.reload()
            this._FFRsrv = new FFR__protocol(this._wsurl);       
            this._FFRsrv.addEventListener('ready', async (event) => {
                console.log('ready');
                const self = this;
                async function __2() {
                    let result = await self._FFRsrv.sendRequestReturningArrayBuffer("test lws");
                    //console.log('result',result)
                    let obj = FSF.parseBuffer(result); 
                    //console.log('obj',obj);
                    const cube = new Cube(obj[0],'zero cube')
                    cube.nonzerostats();
                    console.log(cube)
                }

                __2();
            });
        }
        else if(cap === 'test load svetz-190') {
            this._FFRsrv = new FFR__protocol(this._wsurl);       
            this._FFRsrv.addEventListener('ready', async (event) => {
                console.log('ready');
                const self = this;
                async function __1() {
                    // let data0 = await self._FFRsrv.sendRequestReturningArrayBuffer("test Float32Array long");
                    // // console.log('data',data0); return;
                    // let data1 = FSF.parseBuffer(data0);
                    // console.log('data',data1); return;

                    let data = await self._FFRsrv.sendRequestReturningArrayBuffer("test load svetz-190");
                    let shvetz190 = FSF.parseBuffer(data);
                    // console.log('shvetz190',shvetz190); return;
                    let frame_i_data = await self._FFRsrv.sendRequestReturningArrayBuffer("test load svetz-frame-i");
                    let frame_i = FSF.parseBuffer(frame_i_data)[0];
                    let frame_k_data = await self._FFRsrv.sendRequestReturningArrayBuffer("test load svetz-frame-k");
                    let frame_k = FSF.parseBuffer(frame_k_data)[0];
                    // console.log('frame_k',frame_k); return;
                    let shvetzCube = new Cube(shvetz190[0],'shvetz')
                    // функция shvetz определена в shvetz.js и используется только для тестов
                    // shvetz(shvetzCube,frame_i,frame_k)
                }

                __1();
            });
     
        }
        else if(parentCap === 'Регрессионные тесты')
            RGT.processEvent(e)
    }

    /**
     * FFR.Viewer.loadAortaMask(file) параметр или File или Blob
     * @param {!File|Blob} file
     * @return {Promise}
     */
    loadAortaMask(file) {
      console.log('loadAortaMask()',file);
      return new Promise(function(resolve, reject) {
        let reader = new FileReader();
        reader.onload = function() {
          console.log('res=',reader.result);
          let mask = new Uint8Array(/** @type {ArrayBuffer} */ (reader.result));
          //console.log('mask.byteLength=',mask.byteLength);  // .length - число элементов в массиве
          let firstNz=-1, lastNz=-1, cntNz=0;
          for(let i=0; i<mask.length; i++) {
            if(mask[i] == 0) continue;
            if(firstNz == -1) firstNz = i;
            if(lastNz < i) lastNz = i;
            cntNz++;
          }
          console.log('firstNz=',firstNz,'lastNz=',lastNz,'cntNz=',cntNz);

          // initAMI();
          
          let width=512, height=512, depth = 449;
          console.log('calling MarchingCubes',performance.now());
          let aortaCube = new Cube({dims:[512,512,113], data:mask}, 'AotraMask');
          let aortaGeometry = aortaCube.geometry();
          this.aortaPreviewGeometry = aortaGeometry;
          console.log('aortaPreviewGeometry', aortaGeometry)
          resolve(aortaGeometry);
        };
        reader.onerror = function() {
            console.log(reader.error);
            reject(reader.error);
        };

        reader.readAsArrayBuffer(file);
      });      
    }

    showSemafor(green,version) {
        const self = this
        if(!green) {
            self._semafor.setCaption('🔴');
            self._semafor.setTooltip('FFR сервер закрыл подключение');
            alert('FFR сервер закрыл подключение');
            self._menuItemMarkStenosis.setEnabled(false);
        }  
        else {
            self._semafor.setCaption('🟢');                        
            //let version = await this._FFRsrv.version();
            self._semafor.setTooltip('FFR сервер (версия '+version+') готов @'+this._wsurl);
            self._menuItemMarkStenosis.setEnabled(true);
        }
    }

    /**
     * FFR.Viewer.showInfoMessage(message) 
     * @param {!string} message
     */
    showInfoMessage(message) {
      alert(message);   // потом надо будет оформить как модальный диалог
    }

    set FFRsrv(ffrsrv) {
        this._FFRsrv = ffrsrv;
    }

    set ffrDriver(driver) {
        this._ffrDriver = driver;
    }

}

function logElementSize(el) {
  //var el = this.dialog.dialog.getContentElement()
  var borderBoxSize = goog.style.getBorderBoxSize(el);
  var size = goog.style.getSize(el);
  var computedBoxSizing = goog.style.getComputedBoxSizing(el);
  var visibleRectForElement = goog.style.getVisibleRectForElement(el);
  var bounds = goog.style.getBounds(el);
  var contentBoxSize = goog.style.getContentBoxSize(el);

  console.log('Dialog12 contentElement borderBoxSize=',borderBoxSize)
  console.log('Dialog12 contentElement size=',size)
  console.log('Dialog12 contentElement computedBoxSizing=',computedBoxSizing);
  console.log('Dialog12 contentElement visibleRectForElement=',visibleRectForElement);
  console.log('Dialog12 contentElement bounds=',bounds);
  console.log('Dialog12 contentElement borderBoxSize=',borderBoxSize);
  console.log('Dialog12 contentElement contentBoxSize=',contentBoxSize);
}
