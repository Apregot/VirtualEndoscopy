// Dialog-10: параметры сегментации аорты
//

/** 
 * Состояние, которое передается диалогу-10 (aorta preview)
 * 
 * @typedef {{
 *            tau: number,
 *            alpha: number,
 *            beta: number,
 *            gamma: number,
 *            mesh: (THREE.Mesh|undefined),
 *          }}
 */
var D10StateType;

class Dialog10 {
  /**
   * @param {*} serverInterface класс FFR__protocol
   * @param {!D10StateType} state
   * @param {*} visArea UP3 объект с проинициализированной 3D сценой и запущенным циклом рендеринга
   */ 
	constructor(serverInterface, state, visArea) {
	    console.log('new FFR.Dialog10()')
      this._ffrsrv = serverInterface;
      this._state = state;
      this.visArea = visArea;

	    this.dialog = new gfk.ui.Dialog();
	    this.dialog.setTitle("Параметры сегментации аорты");
      let component = this.dialog.dialog;
      console.log('setting dialog10 non-modal')
      component.setModal(false);
      var element = component.getContentElement(); //console.log('element',element)
      var size = goog.style.getSize(element)
      let id1 = component.makeId('d10-cont');
      this._idTauSpan = component.makeId('d10-span')
	    let contentHTML = '<div id="'+id1+'"></div>';
	    this.dialog.setContent(contentHTML);
	    this.dialog.setContentBackground('#d0d0d0')
	    let contentEl = document.getElementById(id1);
      let tabBar = new gfk.ui.TabBar(contentEl,['Сегментация аорты','Параметры']);
      let sliderId = component.makeId('d10-sl');
      let tab0HTML = `<div class="content">
      <span id="${this._idTauSpan}">Порог:</span><br>
      <p>
      <div id="`+sliderId+`"></div>
      </p>
      <p>
      Выберете порог так, чтобы была видна аорта и 
      части коронарных артерий.
    </p>
    </div>
  </div>`;
      this.inpId1 = component.makeId('inp1');
      this.inpId2 = component.makeId('inp2');
      this.inpId3 = component.makeId('inp3');
  		let tab1HTML = `<div class="content" >
      <fieldset>
        <legend>Vessels</legend>
        <div style="background:#d0d0d0;display: grid;grid-template-columns: 1fr 3fr;"> Alpha: <input type="number" id="`+this.inpId1+`" min="0.2" max=1 step="0.05" value="${this._state.alpha}"> </div>
        <div style="background:#d0d0d0;display: grid;grid-template-columns: 1fr 3fr;"> Beta:  <input type="number" id="`+this.inpId2+`"  min="0.2" max=1 step="0.05" value="${this._state.beta}"> </div>
        <div style="background:#d0d0d0;display: grid;grid-template-columns: 1fr 3fr;"> Gamma: <input type="number" id="`+this.inpId3+`" min=0 max=1000 step=1 value="${this._state.gamma}"> </div>
      </fieldset>
    </div>`;
      	tabBar.setTabContent(0,tab0HTML);
        let sliderDiv = document.getElementById(sliderId);
        this.thresholdSlider = new gfk.ui.Slider(sliderDiv);
      	tabBar.setTabContent(1,tab1HTML);
      	tabBar.setSelectedTabIndex(0);

        this.thresholdSlider.listen( e => this.tauChanged() );
        this.aortaPreviewMesh = null;
        this.serverBusy = false;
        this.tLast = 0;
        this.timerId = 0;
	}
  
  setBusy(busy) {
    this.serverBusy = busy;
    this._updateStatus();
    this.thresholdSlider.slider.setEnabled(!busy);

    const bSet = this.dialog.dialog.getButtonSet();
    bSet.setButtonEnabled('ok',!busy)
    bSet.setButtonEnabled('cancel',!busy)
  }
  _updateStatus() {
    let tauSpan = document.getElementById(this._idTauSpan);
    tauSpan.innerHTML = 'Порог: '+this.getTau() + (this.serverBusy ? '(обработка..)' : '');
  }

  /**
   * Обработчие слайдера тау
   */
  async tauChanged() {
    console.log('Dialog10::tauChanged() ',this.getTau()); 
    this._updateStatus(); 
    // будем пропускать быстрые изменения слайдера
    const firstTime = !this.visArea;
    let t1 =  performance.now(), dt = this.tLast ? t1-this.tLast : 0; // в милисекундах    
    if(!firstTime && dt < 200) {
      if(this.timerId) clearTimeout(this.timerId);        
      this.tLast = t1;
      console.log('пропускаем tau=',this.getTau(),dt);
      this.timerId = setTimeout(() => this.tauChanged() ,200);
      return;
    }

    if(this.timerId) clearTimeout(this.timerId);        
    this.timerId = 0;
    this.tLast = 0;

    console.log('Dialog10::tauChanged() process tau=',this.getTau());

    let scene = this.visArea.scene, camera = this.visArea.camera;

    if(this.serverBusy) {
      console.log("канал занят, жду освобождения..");
      return;
    }

    if(!firstTime) {
      console.log('очищаем сцену');
      // this.clearScene(scene);
      scene.remove(this.aortaPreviewMesh);
      // return;
    }

    this.setBusy(true);
    let t0 = performance.now();
    let data = await this._ffrsrv.LoadAortaPreview(this.getTau());
    console.log('LoadAortaPreview время обработки ', ((performance.now()-t0)/1000).toFixed(3),' сек');

    // console.log('data', hex(data,24));
    // к сожалению, отличить на принимающем конце способ возврата маски аорты не получается, то ли это были посланы
    // сырые данные, то ли FSF.BITMASK. И то и другое приходит как ArrayBuffer. 
    let obj = FSF.parseBuffer(data); //console.log('obj',obj);
    let aortaCube = new Cube(obj[0],'aorta');
    // aortaCube.nonzerostats(); aortaCube.log();
    let  aortaPreviewGeometry = aortaCube.geometry();

    // console.log('aortaPreviewGeometry bounding box',aortaPreviewGeometry.boundingBox)
    var aortaPreviewMesh = new THREE.Mesh(aortaPreviewGeometry, new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide }));
    this.aortaPreviewMesh = aortaPreviewMesh;
    scene.add(aortaPreviewMesh)
    let centerLPS = aortaPreviewGeometry.boundingBox.getCenter();
    let camPos = new THREE.Vector3().addVectors(centerLPS, new THREE.Vector3(150,150,150))
    camera.position.set(camPos.x, camPos.y, camPos.z)
    camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);         
    this.visArea.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);
    console.log('added aortaPreviewMesh')

    this.setBusy(false);
  }

  // рекурсивное удаление содержимого THREE.Object3D, например, сцены.
  // Сам объект при этом не удаляется
  //
  clearScene(obj){
    while(obj.children.length > 0){
      clearThree(obj.children[0])
      obj.remove(obj.children[0]);
    }
    if(obj.geometry) obj.geometry.dispose()
    if(obj.material) obj.material.dispose()
    if(obj.texture)  obj.texture.dispose()
  }

  /**
   * @return {D10StateType}
   */
  getState() { 
    return {
      tau: this.getTau(),
      alpha: this.getAlpha(),
      beta: this.getBeta(),
      gamma: this.getGamma(),
      mesh: this.aortaPreviewMesh,
      }  
  }
 

  getTau() { return this.thresholdSlider.getValue()  / 100}
  getAlpha() { return document.getElementById(this.inpId1).value }
  getBeta() { return document.getElementById(this.inpId2).value }  
  getGamma() { return document.getElementById(this.inpId3).value }  

	exec(f) {
		this.dialog.listen(e => f(e.key));
		this.dialog.show();
    this.thresholdSlider.slider.setValue(this._state.tau * 100);
	}
 }

