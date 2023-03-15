/**
 * Dialog-11: параметры сегментации сосудов
 */ 
class Dialog11 {
  /*
   * @param {*} serverInterface класс FFR__protocol
   * @param {*} visArea UP3 объект с проинициализированной 3D сценой и запущенным циклом рендеринга
   */
	constructor(serverInterface, visArea) {
	    console.log('new FFR.Dialog11()')
      this._ffrsrv = serverInterface;
      this.visArea = visArea;
      this.vesselMesh = null;
	    this.dialog = new gfk.ui.Dialog();
	    this.dialog.setTitle("Параметры сегментации сосудов");
      let component = this.dialog.dialog;
      component.setModal(false);
      this.inpId = component.makeId('d11-inp');
      this._idSpan = component.makeId('d11-span')
	    let content = `<div class="content">
      <fieldset>
        <legend>Параметры сегментации сосудов</legend>
        Порог:  <input type="number"  id="`+this.inpId+`" min="0" max="100" step="1" value="20.0">
        <span id="${this._idSpan}"></span>
        <p>
        Выберите порог, чтобы найти коронарные артерии. Чем ниже порог, тем большая<br>
        область будет включена.
        </p>
        <fieldset>
          <legend>Выделение участков сосуда</legend>
          <button>Назад</button>
          <button>Вперед</button>
          <button>Указать участок сосуда</button>
        </fieldset>
      </fieldset>
    </div>`
	    this.dialog.setContent(content);

      let input = document.getElementById(this.inpId);
      input.onchange = e => this.inputChanged();


	    // this.dialog.setContentBackground('#fff');
	    // this.dialog.setTitle('DICOM');
	    // this.dialog.setTitleBackground('#fff');
     //    let buttonSet = new goog.ui.Dialog.ButtonSet();
     //    buttonSet.addButton({caption:'Да', key:'OK'},true); // default
     //    buttonSet.addButton({caption:'Нет', key:'CANCEL'},false,true); // cancel
     //    this.dialog.setButtonSet(buttonSet);

	}

  async inputChanged() {
    console.log('D11 inputChanged()')
    if(!this.dialog.dialog.isVisible()) {
      // this.dialog.dialog.setVisible(true)
      console.log('D11 is not visible..returning');
      return;
    }
    let input = document.getElementById(this.inpId);
    let span =  document.getElementById(this._idSpan);
    // console.log('inp1 value=',input.value);

    input.disabled = true; span.innerHTML = '(обработка..)';
    const bSet = this.dialog.dialog.getButtonSet();
    bSet.setButtonEnabled('ok',false);
    bSet.setButtonEnabled('cancel',false);


    let scene = this.visArea.scene;

    let t0 = performance.now(), t00 = t0;
    console.log(`calling LoadVesselsPreview(${input.value})`)
    let vesselsData = await this._ffrsrv.LoadVesselsPreview(input.value);
    console.log('LoadVesselsPreview returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');

    let obj = FSF.parseBuffer(vesselsData); //console.log('obj',obj);
    if(obj.length > 0) {
      let vesselsCube = new Cube(obj[0],'vessels');
      // aortaCube.nonzerostats(); aortaCube.log();
      t0 = performance.now();
      let  vesselGeometry = vesselsCube.geometry(); 
      console.log('vesselsCube.geometry() takes ', ((performance.now()-t0)/1000).toFixed(3),'сек');

      if(this.vesselMesh)
        scene.remove(this.vesselMesh);
      this.vesselMesh = new THREE.Mesh(vesselGeometry, new THREE.MeshLambertMaterial( { color: 0xfafa00, side: THREE.DoubleSide }));
      scene.add(this.vesselMesh)
    }

    input.disabled = false; span.innerHTML = '';
    bSet.setButtonEnabled('ok',true);
    bSet.setButtonEnabled('cancel',true);

    console.log('к сцене добавлен vesselMesh за ', ((performance.now()-t00)/1000).toFixed(3),'сек')
  }

  getVesselsThreshold() { return document.getElementById(this.inpId).value; }

	exec(f) {
		this.dialog.listen(e => f(e.key));
		this.dialog.show();
    this.inputChanged();  // default значение  
	}
}


