goog.require('goog.ui.Container');

class FakeLeftPanelComponent extends goog.ui.Container {

    /** @param {*} viewer Viewer */
    constructor(viewer) {
        // console.log('FFR.ui.FakeLeftPanelComponent() constructor')
        super();
        this._quadview = viewer._quadview;
        this.box = []
    }

    /** @override */
    createDom() {
        // console.log('FakeLeftPanelComponent::createDom()')
        // GCC дает ошибку при использовании base в ES6 классе, говорит, что надо использовать super
        // FakeLeftPanelComponent.base(this, 'createDom');        
        super.createDom();
        this.getElement().innerHTML = div_vis_lower;
    }

    enterDocument() {
        console.log('MarkStenosisComponent::enterDocument()')
        super.enterDocument();

        goog.events.listen(this._quadview, 'ROIChanged', (e) => this._onROIChanged(e));
        const btnResetROI = document.getElementById('reset_roi') 
        btnResetROI.addEventListener('click', e => this._quadview.resetROI())
        const btnInitializeFFR = document.getElementById('initialize_ffr') 
        btnInitializeFFR.disabled = true
        btnInitializeFFR.addEventListener('click', e => this._onInitializeFFR())
        for(let el of ['roi_min_x', 'roi_min_y', 'roi_min_z', 'roi_size_x', 'roi_size_y', 'roi_size_z']) {
            const inp = document.getElementById(el)
            inp.addEventListener('change',e => this._onInputChanged(e));
            this.box.push(inp)
        }

    }

    print() {
        console.log('myId '+this.getId());
    }

    /** @param {goog.events.Event} e */
    _onInputChanged(e) {
        // управление стрелками соблюдает <input>.min,
        // но руками можно ввести и отрицательные числа
        const inp = this.box.map( el => parseInt(el.value))
        const pmin = new THREE.Vector3(inp[0],inp[1],inp[2])
        const pmax = new THREE.Vector3(inp[0]+inp[3],inp[1]+inp[4],inp[2]+inp[5])
        const box = new THREE.Box3(pmin, pmax) 
        //console.log('about to set ROI',box)
        this._quadview.ROI = box       
        // const el = document.getElementById(e.target.id)
        // console.log(`_onInputChanged ${e.target.id}=${el.value}`,el.value)
        // console.log('box',box)
    }

    /** @param {goog.events.Event} e */
    _onROIChanged(e) {
        const ROIbox = e.value;
        document.getElementById('roi_min_x').value = ROIbox.min.x;
        document.getElementById('roi_min_y').value = ROIbox.min.y;
        document.getElementById('roi_min_z').value = ROIbox.min.z;
        document.getElementById('roi_size_x').value = ROIbox.max.x - ROIbox.min.x;
        document.getElementById('roi_size_y').value = ROIbox.max.y - ROIbox.min.y;
        document.getElementById('roi_size_z').value = ROIbox.max.z - ROIbox.min.z;

        // любой сигнал от QuadView ROIChanged пока означает, что загружен стек
        // и значит надо разрешить кнопку Initialize FFR processing 
        //
        document.getElementById('initialize_ffr').disabled = false;
    }

    // кнопка Initialize FFR processing
    _onInitializeFFR() {
        //console.log('Initialize FFR processing button pressed')
        this._onInputChanged()  // обновим ROI, e как параметр не важен
        this._quadview.initializeFFRProcessing();

    }
}

FFR.ui.FakeLeftPanelComponent = FakeLeftPanelComponent;

// вот как раз при наследовании через ES6 класс это не надо!
// goog.inherits(FakeLeftPanelComponent, goog.ui.Container);

    var div_vis_lower = `<div class="content">
      <fieldset><legend>3D Сегментация</legend>  
          ROI для автосегментации:<p> 
          Позиция (x,y,z):<br>
          <input type="number" value="0" min="0" id="roi_min_x" style="width: 6em;"/>       
          <input type="number" value="0" min="0" id="roi_min_y" style="width: 6em;"/>       
          <input type="number" value="0" min="0" id="roi_min_z" style="width: 6em;"/>       
          Размер (x,y,z):<br>
          <input type="number" value="1" min="1" id="roi_size_x" style="width: 6em;"/>       
          <input type="number" value="1" min="1" id="roi_size_y" style="width: 6em;"/>       
          <input type="number" value="1" min="1" id="roi_size_z" style="width: 6em;"/>  
          <p>    
          <button id="reset_roi">Сбросить ROI</button> 
          <button id="initialize_ffr">Initialize FFR processing</button>
        </fieldset>

      </div>`;


/**
 * @constructor
 * @extends {goog.ui.Container}
 */
let myComponent = function() {
    console.log('new myComponent()')
    myComponent.base( this, 'constructor' );
};

// переопределенный метод createDom почему-то не срабатывает
/** @override */
myComponent.prototype.createDom = function() {
    myComponent.base(this, 'createDom');
    this.getElement().innerHTML = 'hello'
    console.log('myComponent::createDom()')
}
goog.inherits(myComponent, goog.ui.Container);

