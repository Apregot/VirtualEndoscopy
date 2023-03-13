goog.require('goog.style');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.ui.Component');
goog.require('goog.ui.PopupMenu');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.SubMenu');
goog.require('goog.asserts');

goog.require('gfk.ui.TabBar');
goog.require('gfk.ui.SplitPane');
goog.require('gfk.ui.SplitPaneExpanded');

// Список серий. Вынесен как класс из кода main.js Viewer, хотя по смыслу является его составной частью
// Это с одной стороны разгружает код main.js, который уже начал приближаться к 1000 строкам, а с другой стороны
// список серий имеет собственную функциональность как сущность - добавить/убрать серию, resize, контекстное меню и т.д.
// и в этом  плане он является полноценным объектом, то есть классом, хотя и в единственном экземпляре.
// Это новая для меня техника, посмотрим, что получился.
// Пока этот список будет состоять всегда из одной серии на закладке. Это связано с тем, что хотя AMI.VolumeLoader
// а следовательно и мой FileVolumeLoader, могут читать справочники, содержащие более одной серии, но нет внятного
// механизма разделения серий, то есть результирующей серией будет считаться случайная серия 0. А самое главное,
// метаинформация в парсере расчитана ровно на одну серию. Метаинформация второй серии, прочитанная в пакетном режиме,
// затрет первую. При этом сам стек может оказаться от первой серии, а метаинйормация от второй (см. Почукаева-тест/{SE12,SE13}) 
// Это все можно корректно обработать, но не сейчас. А вот много вкладок с разными пациентами может быть.
//
// 05.11.21 Список серий теперь оформлен не просто как класс, а как goog.ui.Component. Это дает возможность включать его 
// в другие компоненты, а также получать вызов resize(), когда он является частью сплиттера

class SeriesListsComponent extends goog.ui.Component {

    constructor() {        
        // console.log('constructor SeriesListsComponent() as goog.ui.Component')
        super();
        this._tabbar = null;
        this._worklistSpl = null;

        // worklist - это массив gfk.ui.SplitPane в котором хранятся содержимые закладок с сериями
        // индекс закладки соотвествует индексу SplitPane в массиве
        this._worklist = [];

        this._seriesCount = 0;          // это счетчик серий, служит для создания уникального UID SeriesItem
        this._seriesMap = new Map();    // seriesId -> {wspl:gfk.ui.SplitPane();}

        this._selectedItemId = null;
    }

    /** @override */
    createDom() {
        // console.log('SeriesListsComponent::createDom()')
        super.createDom();
        this.getElement().style.height = "100%";
        this._tabbar = new gfk.ui.TabBar(this.getElement(),[]);
    }

    enterDocument() {
        // console.log('SeriesListsComponent::enterDocument()')
        super.enterDocument();
        this.searchOrAddNewSeriesTab('Несортированные изображения');
        this._tabbar.setSelectedTabIndex(0);
        // установка общего обработчика для закрытия закладки с сериями
        this._tabbar.setCloseEventListener(e=>this.closeTab(/** @type {goog.ui.Tab} */(e.target)));
    }

    setVisible(vis) {
        this.getElement().style.display = vis ? 'block': 'none';
    }

    /**
     * Обработчик контекстного меню карточек серий
     * @param {goog.events.Event} e
     */
    processListItemContextMenu(e) {
        // console.log('SeriesLists::processListItemContextMenu(e)')
        let series = e.currentTarget.getModel(), stack = series.stack[0];
        let itemId = series._id; //console.log('itemId',itemId)
        
        let caption = e.target.getCaption();

        if(caption.startsWith('Открыть серию')) {
            this.setSelectedItem(itemId);
            FFR.viewer._quadview.loadSeries(series);
        }
        else if(caption.startsWith('Закрыть')) {
            // console.log('Закрыть ListItem ',itemId)

            // надо очистить QuadView если там рендериться закрываемая серия
            if(itemId == this._selectedItemId)
                FFR.viewer._quadview.clear()    // да, пользуемся приватным полем viewer'a

            const numEntriesRemaining = this.removeSeriesListItem_(itemId);
            // если на закладке больше нет серий, то удаляем закладку
            if(numEntriesRemaining == 0) 
                this.closeTab(this._tabbar.tabBar.getSelectedTab());
        }
        else if(caption.startsWith('до ')) { // 'до ZZZ срезов'
            let parts = caption.split(' ');
            let thinSeries = this.seriesThinOut(series,parseInt(parts[1],10));
            this.addNewSeries(thinSeries);
        }
        else if(caption.startsWith('Обрезать')) {
            console.log('Обрезать')
            // это Осипов [380,550] это диапазон файлов, а фреймы идут в обратном порядке
            // IMG-0001-00001 - это frame[599]
            // IMG-0001-00600 - это frame[0]
            // IMG-0001-[380,550] ->frame[50,220]
            //let thinSeries = this.seriesResize(series,[50,220]); // Осипов

            // Домаскин полный IMG0001-IMG0856] фреймы вообще в беспорядке
            // IMG[495-795] соотвествуют фреймам [61-361] (надено экспериментально)
            //let thinSeries = this.seriesResize(series,[61,361]); // Домаскин

            // Швец frame[0]- 00295.dcm frame[294] - 00001.dcm; 106-295 [0,189]
            //let thinSeries = this.seriesResize(series,[0,189]); // Швец

            // это эксперименты с seriesResize из ffrdriver.js
            // он позволяет обрезать стек кадров по всем направлениям
            // let thinSeries = seriesResize(series,[[12,499],[12,499],[]]);  // Домаскин 488
            let thinSeries = seriesResize(series,[[164,475],[94,284],[191,300]]);  // Д-300 c minROI
            //let thinSeries = seriesResize(series,[[159,480],[89,289],[186,300]]);  // Д-300-min+
            //let thinSeries = seriesResize(series,[[111,395],[147,373],[8,448]]);  // П-449-min+

            this.addNewSeries(thinSeries);
        }
    }

    /**
     *  Это приватная функция, которая удаляет указанную карточку серии из списка серий на закладке
     *  @param {!string} itemId
     *  @return {number} число оставшихся серий в на закладке
     */
    removeSeriesListItem_(itemId) {
        console.log('removeSeriesListItem_('+itemId+')')
        // ctx:{wspl: gfk.ui.SplitPaneExpanded}
        let ctx = this._seriesMap.get(itemId); //console.log('ctx',ctx)
        goog.asserts.assert(ctx);
        let spl = ctx.wspl; //console.log('spl',spl);
        // т.к. spl это gfk.ui.SplitPaneExpanded, то у него нет своего поля 'rhs', 
        // это поле наследуется от родителя gfk.ui.SplitPane
        // поэтому надо все аккуратно накрывать геттерами
        // почему-то геттером не получилось, пришлось вводить поля rhs и lhs в gfk.ui.SplitPaneExpanded
        // хотя в родительском классе они есть, но до них не добраться
        // console.log('spl rhs',spl.rhs)
        let rhsElement = spl.rhs.getElement();

        // удаляем listEntry, чистим map TBD: очистить quadview, если надо? --нет это не этого уровня функциональность
        let entryDiv = document.getElementById(itemId); 
        goog.asserts.assert(entryDiv);
        rhsElement.removeChild(entryDiv);
        this._seriesMap.delete(itemId);

        return rhsElement.children.length;
    }

    /**
     *  Это приватная функция, которая удаляет закладку 
     *  Предполагается, что список серий пустой
     *  @param {!goog.ui.Tab} tab
     */
    closeTab(tab) {
        console.log('removeSeriesList_() удаляем закладку и SplitPane')
        const tabIndex = this._tabbar.tabBar.indexOfChild(tab);
        let wspl = this._worklist[tabIndex];    // gfk.ui.SplitPane
        let rhsElement = wspl.rhs.getElement();
        while( rhsElement.children.length > 0) 
            this.removeSeriesListItem_(rhsElement.children[0].id);
        this._worklist.splice(tabIndex,1);
        this._tabbar.tabBar.removeChild(tab, true);
    }

    /**
     * Этот метод прореживает данную ему серию, так чтобы в ней было не более 'limit' кадров 
     * Почему-то Мультивокс прореживает серию по степеням 2-ки - каждый 2,4,8.. кадр, пока не будет меньше limit
     * @param {*} series AMI.SeriesModel
     * @param {!number} limit
     * @return {*} AMI.SeriesModel
     */
    seriesThinOut(series, limit) {
        console.log(`SeriesLists::seriesThinOut(${limit})`)

        // создаем копию AMI.SeriesModel
        let newSeries = new AMI.SeriesModel();
        for (let key in series) 
            newSeries[key] = series[key];

        // создаем копию стека. для массива frame[] создаем собственную копию
        let oldStack = series.stack[0], newStack = new AMI.StackModel();
        for (let key in oldStack) 
            newStack[key] = oldStack[key];
        newStack.frame = oldStack.frame.slice(0);   // возвращает копию исходного массива

        // вычисляем коэффициент прореживания (и надо ли вообще прореживать)
        // оказалось, что полагаться на Series.numberOfFrames нельзя. Оно вычисляется как значение
        // DICOM x00280008 и, например, у Почукаевой он задан, а у многих нет. Более надежным является
        // stack.numberOfFrames, да и то его значение действительно только после stack.prepare()
        // при этом геттера stack.numberOfFrames() нет, приходится обращаться как stack['_numberOfFrames']
        // в самом AMI по этому поводу написано "need something smarter!"
        // console.log(`new Series.numberOfFrames ${newSeries.numberOfFrames}`)
        // console.log(`old Series.numberOfFrames ${series.numberOfFrames}`)

        let numberOfFrames = newStack['_numberOfFrames']; 
        if(numberOfFrames <= limit) 
            console.log('прореживание не требуется');
        else {
            var N = 2;
            while(numberOfFrames / N  > limit)
                N *= 2;
            for(var i=0; i<newStack.frame.length; i++)
                newStack.frame.splice(i+1,N-1);
        }
        newStack.prepare();
        newSeries.numberOfFrames = newStack['_numberOfFrames'];
        newSeries.stack = [newStack];

        // console.log('прореженная серия',newSeries)
        // console.log('исходная серия',series)  

        return newSeries;
    }

    /**
     * Этот метод вызывается из обработчика "Загрузить DICOM dir/file" и при добавлении прореженной серии
     * Он создает при необходимости новую закладку с именем пациента и добавляет карточку серии и 
     * заполняет Информацию для серии
     * --@param {*} series AMI.SeriesModel
     */
    addNewSeries(series) {
        // console.log(`SeriesLists::addNewSeries() series.numberOfFrames ${series.numberOfFrames}`)
        let stack = series.stack[0];
        console.log(`addNewSeries stack [${stack._rows},${stack._columns},${stack._numberOfFrames}]`)

        // i->frame[i]._url.name
        // const framesmap = new Map(stack.frame.map((obj,ind) => [ind,obj._url.name]))
        // console.table('frame map ',framesmap)
        // console.log('stack.frames',stack.frame)

        let metaInfo = new Map();
        metaInfo.set("SN",series['rawHeader'].string('x00200011'));    // series number
        metaInfo.set("PN",series['rawHeader'].string('x00181030'));    // protocol name
        metaInfo.set("image",thumbAxialSlice(stack));
        metaInfo.set("SD",series.seriesDescription);
        metaInfo.set("NF",series.numberOfFrames);
        metaInfo.set("modality",series.modality);
        metaInfo.set("patientName",series.patientName);
        metaInfo.set("patientSex",series.patientSex);
        metaInfo.set("patientBirthdate",series.patientBirthdate);
        metaInfo.set("studyDate",series.studyDate);

        let tabInd = this.searchOrAddNewSeriesTab(series.patientName);
        this._tabbar.setSelectedTabIndex(tabInd);
        let spl = this._worklist[tabInd];
        // let wsplElement = spl.splitpane.getElement();
        // console.log('SeriesLists::addNewSeries() new tabInd=',tabInd,spl,wsplElement)

        // let t1Html = this.makeStudiesListEntryHTML();
        // worklistSpl.setRhsHTMLContent(t1Html);
        let itemId = this._tabbar.tabBar.makeId(''+this._seriesCount++);
        let listEntryElement = this.makeStudiesListEntryElement(metaInfo,itemId);
        spl.getChildAt(1).getElement().appendChild(listEntryElement);
        spl.getChildAt(0).getElement().innerHTML = this.makeStudiesListInformationHTML(metaInfo);
        this.resize();

        let self = this;
        series._id = itemId;
        this._seriesMap.set(itemId,{wspl:spl});

        function rContextMenu(e) {
            // console.log('listItem.oncontextmenu',e)
            // это запрещает показ default menu 
            // интересно, а почему без этого срабатывает в V5-dev?
            e.preventDefault(); 

            var rContextMenu = new goog.ui.PopupMenu();

            // Так можно ассоциировать с меню или  MenuItem любую информация
            // это метод goog.ui.Component ID должен быть unique string
            // есть еще goog.ui.Component.setModel(obj)
            rContextMenu.setModel(series);

            rContextMenu.addItem(new goog.ui.MenuItem('Открыть серию'))
            var subMenu1 = new goog.ui.SubMenu("Проредить серию");
            subMenu1.addItem(new goog.ui.MenuItem('до 100 срезов'));
            subMenu1.addItem(new goog.ui.MenuItem('до 200 срезов'));
            subMenu1.addItem(new goog.ui.MenuItem('до 500 срезов'));
            subMenu1.addItem(new goog.ui.MenuItem('до 750 срезов'));
            rContextMenu.addItem(subMenu1);
            rContextMenu.addItem(new goog.ui.MenuItem('Закрыть серию'))
            rContextMenu.addItem(new goog.ui.MenuItem('Обрезать'))

            //rContextMenu.addItem(new goog.ui.MenuSeparator());
            rContextMenu.render(document.body);
            rContextMenu.showAt(e.clientX,e.clientY,goog.positioning.Corner.BOTTOM_LEFT);
            rContextMenu.setVisible(true);

            goog.events.listen(rContextMenu, 'action', (e) => self.processListItemContextMenu(e));

            return false;

        }

        listEntryElement.oncontextmenu = (e) => {rContextMenu(e)}
    }

    /**
     * Этот метод ищет закладку в списках серий с указанным именем и, если не находит, то создает новую. 
     * @param {string} label
     * @return {number}  Tab index
     */
    searchOrAddNewSeriesTab(label) {
        // console.log('searchOrAddNewSeriesTab()')

        for(let i=0; i < this._tabbar.tabBar.getChildCount(); i++) 
            if(label == this._tabbar.tabBar.getChildAt(i).getContent())
                return i;

        // все "реальные" серии, то есть не пустышку 'Несортированные изображения'
        // создаем с крестиком tabClose и обработчиком закрытия закладки. 
        const opt_tabClose = (label != 'Несортированные изображения');
        this._tabbar.addTab(label, opt_tabClose);

        const tabInd = this._tabbar.tabBar.getChildCount()-1;
        var tab1El = this._tabbar.getTabContentElement(tabInd);
        var t1ContentEl = this._tabbar.tabBar.getContentElement();

        var worklistSpl = new gfk.ui.SplitPaneExpanded(); this._worklistSpl = worklistSpl;
        worklistSpl.render(tab1El); 
        this._worklist.push(worklistSpl);

        let wsplSize = goog.style.getSize(t1ContentEl);
        // высота картинки p1 (Почукаева-1) 147px
        wsplSize.height = 150;
        let wspl_lhsElement1 = worklistSpl.getChildAt(0).getElement();
        let wspl_rhsElement1 = worklistSpl.getChildAt(1).getElement();
        goog.style.setStyle(wspl_lhsElement1, 'border', '0px solid red');
        goog.style.setStyle(wspl_rhsElement1, 'border', '0px solid red');
        wspl_lhsElement1.style.background='#000';
        wspl_rhsElement1.style.background='#222';
        //wspl_rhsElement1.style.overflow='scroll';
        let wsplElement = worklistSpl.getElement();

        // wsplSize.width = 600;
        // console.log('wsplSize',wsplSize)
        // worklistSpl.setSize(wsplSize,350);  // хак
        wspl_lhsElement1.innerHTML = this.makeStudiesListInformationHTML();

        // правый контейнер будет flex-контейнером
        let container = worklistSpl.getChildAt(1).getElement();
        goog.style.setStyle(container, 'display', 'flex');
        // console.log('spl.rhs.getElement()',container)

        return tabInd;
    }

    /**
     * Карточка серии в виде DOMElement
     * @param {!Map} extraMetaInfo
     * @param {!string} itemId
     * @return {Element} DOMElement с карточкой серии
     */
    makeStudiesListEntryElement(extraMetaInfo, itemId) {
        // console.log('makeStudiesListEntryElement() itemId',itemId)
        const spanStyle = "width:200px; word-wrap:break-word; color:white;";
        const spanStyleSmall = "width:200px; word-wrap:break-word; color:white; font-size:x-small;";
        let imgDefault = goog.dom.createDom('img', {"src": "img/series-lists-item-tumb.png", "style":"float:left"});
        const img = extraMetaInfo.get("image"); // imgDefault; //
        const SN = extraMetaInfo.get("SN");
        const PN = extraMetaInfo.get("PN");
        const SD = extraMetaInfo.get("SD");
        const NF = extraMetaInfo.get("NF");

        // img.style.float='left';
        // goog.style.setStyle(img, 'width', '128px');
        // goog.style.setStyle(img, 'height', '128px');
        // console.log('img',img)
        let imgDiv = goog.dom.createDom("div", {"style":"float:left; width:128px; height:128px;"},img);

        let span1 = goog.dom.createDom("span", {"style": spanStyle},'Номер: '+SN);
        let span2 = goog.dom.createDom("span", {"style": spanStyleSmall},'PN:   '+PN);
        let span3 = goog.dom.createDom("span", {"style": spanStyleSmall},'SD:   '+SD);
        let span4 = goog.dom.createDom("span", {"style": spanStyleSmall},'Кадров: '+NF);
        // let textDiv =  goog.dom.createDom("div", {"style":"float:right"}, span1,span2,span3);
        let content = [imgDiv,span1,goog.dom.createDom("BR")];
        if(PN) {
            content.push(span2);
            content.push(goog.dom.createDom("BR"))
        }
        content.push(span3);
        content.push(goog.dom.createDom("BR"));
        content.push(span4);
        //background:#726886
        let entryContainer = goog.dom.createDom("div", {"id": itemId, "style": "background:#333; width:300px; height:130px; margin:5px;"},content);
        // console.log('entryContainer',entryContainer)

        return entryContainer;
    }

    /**
     * Карточка серии в виде HTML (это макет)
     * @return {string}
     */
    makeStudiesListEntryHTML() {
        // let t1Html = '<img src="img/p1.png" id="p1"> ';  style="float:left"
        let t1Html = `<div style="background:#726886; width:300px; height:130px; ">
            <div>
            <img src="img/series-lists-item-tumb.png" width="128" height="128">
            </div>
            <span style="width:200px; word-wrap:break-word; color:white;"> Номер: 3 </span><br>
            <span style="width:200px; word-wrap:break-word; color:white; font-size:x-small;"> 
             PN:   5.25 Calcium Scoring + Coronary Artery 30-74 BPM 
            <br>SD: SEGMENT 739ms 0.00s Cardiac 0.5 CE CTA/SEGMENT CTA 739m 
            <br> Кадров: 193</span>
                     </div>`;
        return t1Html;
    }

    /**
     * Информация о серии в виде HTML
     * @param {Map=} extraMetaInfo
     * @return {string}
     */
    makeStudiesListInformationHTML(extraMetaInfo) {
        //id="${tab0DivId}";

        const modality          = extraMetaInfo ? extraMetaInfo.get("modality") : '';
        const patientName       = extraMetaInfo ? extraMetaInfo.get("patientName") : '';
        const patientSex        = extraMetaInfo ? extraMetaInfo.get("patientSex")  : '';
        const patientBirthdate  = extraMetaInfo ? extraMetaInfo.get("patientBirthdate")  : '';
        const studyDate         = extraMetaInfo ? extraMetaInfo.get("studyDate")  : '';

let tab_unsorted_HTML=`<div style="display:flex; background:#3a3a3a">
    <div style="display:flex; flex-direction:column;">
      <button title="Закрыть изображения">X</button>
      <button title="Экспорт изображений на CD/USB"><img src="img/CD-ROM-icon.png" /></button>
      <button title="Отправить изображение на PACS"><img src="img/Save-PACS.png"/></button>
      <button title="Сделать снимок экрана"><img src="img/camera.png"/></button>
    </div>

    <div >
      <fieldset style="color:white;">
        <legend>Информация</legend>
          [${modality}] ${patientName}
          <p>
            Карта:<br>
            Пол: ${patientSex}<br>
            Дата рождения: ${patientBirthdate}<br>
            Дата посещения: ${studyDate}<br>
          </p>  
      </fieldset>
    </div>
    <div style="display:flex; flex-direction:column;">
      <button title="Сортировка изображений: &#013;Номер изображения">N</button>
      <button title="Сортировка изображений: &#013;Протокол регистрации">PN</button>
      <button title="Сортировка изображений: &#013;Описание изображения">SD</button>
      <button title="Сортировка изображений: &#013;Время">T</button>
    </div>
  </div>`;

        return tab_unsorted_HTML;
    }    

    /**
     * Выделить указанную карточку серии
     * @param {!string} itemId
     */
    setSelectedItem(itemId) {
        let itemContainer = document.getElementById(itemId);
        goog.asserts.assert(itemContainer);
        goog.style.setStyle(itemContainer, 'background', '#726886');
        this._selectedItemId = itemId;
    }

    resize() {
        // console.log('SeriesListsComponent::resize()')
        let elem = this.getElement(); //console.log('elem',elem)
        let size = goog.style.getSize(elem); //console.log('size',size)
        this._worklistSpl.setSize(size,230)
    }

}

