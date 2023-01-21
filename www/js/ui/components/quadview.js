/*
 * Класс QuadView управляет рендерингом в областях r0 (3D) и r1,r2,r3 (2D) 
 * и должен существовать в единственном экземпляре
 * Этот класс также управляет совместно с LeftPanelComponent (в ее части FakeLeftPanelComponent,
 * причем слово Fake теперь уже не соответствует действительности) границами Region Of Interest ROI
 * подобласти DICOM, в котором будет осуществляться сегментация аорты и коронарных сосудов.
 * QuadView обеспечивает графическое изображение рамки на срезах r1,r2 и r3, а также захват мышкой
 * рамки ROI и изменение границ. LeftPanelComponent отображает границы и размеры ROI в полях ввода
 * и, в свою очередь, позволяет их изменять. QuadView владеет ROI box, который является общими данными 
 * 2-х компонент и оповещает о его изменении через Event 'ROIChanged', на который подписан 
 * LeftPanelComponent. В свою очередь изменение ROI box со стороны LeftPanelComponent происходит 
 * непосредственно через сеттер в QuadView.
 */
goog.require('goog.dom');
goog.require('goog.ui.Component');

 class QuadView extends goog.ui.Component {

  /** @param {*} viewer Viewer */
 	constructor(viewer) {
 		// console.log('QuadView::constructor() as Component')
 		super();
  	this._viewer = viewer;
 		this._r0 = this._r1 = this._r2 = this._r3 = null;
 		this._FFRDriver = null;
		this._series = null;

		// да, теперь подключение к серверу перешло сюда из main
		setTimeout( () => {
			this._FFRsrv = new FFR__protocol(AppConfig.wsurl);		
			this._FFRsrv.addEventListener('ready',  event => this._onConnect());
			this._FFRsrv.addEventListener('close',  event => this._onDisconnect());
		}, 3000);

		// ROI в quadview имеет тот же смысл, что и в Cube, но является объектом THREE.Box3,
		// а не массивом из 6 чисел. Quadview.ROI является подпространством, установленном 
		// пользователем, в котором будет происходить сегментация аорты и коронарных сосудов.
		// В частности на верхнем слое ROI будет искаться срез аорты.
		// Размер ROI по всем направлениям определяется как max-min. 
		// Индексы начинаются с 0, например DICOM 512x512x640 будет иметь ROI 
		// Box3([0,0,0],[512,512,640]). Quadview следит за тем, чтобы ROI имел ненулевой объем
		// Важное оличие Cube ROI от Quadview ROI помимо типа состоит в том, что Cube ROI включает
		// 
		//
		/** THREE.Box3 */
		this._ROI = null;

		// handle является экземпляром объекта Locator и появляется при захвате границы ROI, 
		// либо угловой точки рамки. 
		// handle появляется на mousedown, если что-то захвачено и исчезает на mouseup
		// при движении мыши вне объема исходного куба обновление ROI не происходит 
		// 
		// Объект Locator {rxx, pointer:Vector3, cursor, dir:Vector3} возвращается locateEvent(event)
		// 
		// locateEvent(event) может вернуть null в каком-то гипотетическом случае, когда событие onMouseMove
		// поймано, но это произошло не над r1, r2 или r3 (а такого не может быть). Поэтому поле 
		// 'rxx' можно считать всегда !null. 
		// 'pointer' будет null, если в quadview еще не загружена серия, либо курсор находится не над срезом, 
		//   то есть между срезом и границей rx. Иначе 'pointer' будет содержать координаты IJK точки под курсором
		// 'cursor' имеет значение 'default' либо '{n w s e nw ne se sw}-resize' если находится над рамкой ROI
		// 'dir' будет !null, если курсор находится над рамкой ROI, то есть ее можно схватить. В этом случае 'dir'
		//   представляет собой Vector3, в полях x,y и z которого могут стоять -1, 0 или 1. 
		//   -1 означает, что движение рамки затрагивает ROI.min точку в соотвествуюшем измерении
		//    1 означает, что движение рамки затрагивает ROI.max точку в соотвествуюшем измерении
		//    0 значит движение рамки не влияет на ROI в этой координате
		//   например, верхняя рамка r1 соответствует нижней координате Z, значит для нее dir=Vector3(0,0,-1)
		//             левая  рамка r1 соответствует верхней координате X, значит для нее dir=Vector3(1,0,0)
		//   таким образом захват северо-западного угла (NW) рамки r1 будет суперпозицией dir=Vector3(1,0,-1),
		//   то есть влиять сразу на нижний Z и верхний X ROI box
		this.handle = null;

		// RXX - rx eXtended, можно было бы эти поля поместить в UP3.rx, но не хочется делать
		// помойку. Там stackHelper уже лишний. Наследие amiviewer.js. И LUT лишний,
		// все кому не лень набивают туда мусор. Назначение N и W см. setNW
		const RXX = {rx:null, borderROI: null, NWSE: [null,null,null,null]};
		this.rxx = [Object.assign({},RXX), Object.assign({},RXX), Object.assign({},RXX),];

 	}

 	async _onConnect() {
 		console.log('onConnect')
 		let version = await this._FFRsrv.version();
 		this._viewer.showSemafor(true,version)
 		this._viewer.FFRsrv = this._FFRsrv;
 	}
 	_onDisconnect() {
 		console.log('onDisonnect')
 		this._viewer.showSemafor(false)
 	}

  /** @override */
  createDom() {
      super.createDom();
      const elem = this.getElement();
      goog.dom.classlist.add(elem,'visualizer');
      elem.appendChild(this._r0 = goog.dom.createDom("div", {"id": "r0", "class": "renderer"}));
      elem.appendChild(this._r1 = goog.dom.createDom("div", {"id": "r1", "class": "renderer"}));
      elem.appendChild(this._r2 = goog.dom.createDom("div", {"id": "r2", "class": "renderer"}));
      elem.appendChild(this._r3 = goog.dom.createDom("div", {"id": "r3", "class": "renderer"}));
  }

  /** @override */
  enterDocument() {
    super.enterDocument();
    const elem = this.getElement();
    // console.log('QuadView::enterDocument() element=',elem, elem.parentNode)
		this._r0 = UP3.enable('r0');	// UL: 3D
		this._r1 = UP3.enable('r1')		// UR: плоскость XZ 'coronal'
		this._r2 = UP3.enable('r2')		// LL: плоскость YZ 'sagittal' по горизонтали Y растет влево про inverse
		this._r3 = UP3.enable('r3'); 	// LR: плоскость XY 'axial'  у Почукаевой Y растет вниз!
		this._r1.sliceOrientation = 'coronal'; 	
		this._r2.sliceOrientation = 'sagittal'; 
		this._r3.sliceOrientation = 'axial'; 
		UP3.initRenderer3D('r0');	
		// почему-то стандартную скорость вращения 5.5, которая вполне подходит для других сцен
		// надо сильно уменьшить для сцены с 3 секущими плоскостями, иначе все крутится как волчок
		this._r0.controls.rotateSpeed = 0.1;
		UP3.initRenderer2D('r1');	
		UP3.initRenderer2D('r2');
		UP3.initRenderer2D('r3');
		this.rxx[0].rx = this._r1;
		this.rxx[1].rx = this._r2;
		this.rxx[2].rx = this._r3;
  
		for(let r of this.rxx) {	
	    r.rx.domElement.addEventListener('mousedown', e => this.onMousedown(e));
	    r.rx.domElement.addEventListener('mouseup', e => this.onMouseup(e)); 
	    r.rx.domElement.addEventListener('mousemove', e => this.onMousemove(e));
	    r.rx.controls.addEventListener('OnScroll', event => this.onScroll(event));
    }	     
	}

	// event.target это сам control
	onScroll(event) {
	  const id = event.target.domElement.id
	  const rxx = (id == 'r1' ? this.rxx[0] : id == 'r2' ? this.rxx[1] : id == 'r3' ? this.rxx[2] : null)
	  if(!rxx || !rxx.rx.stackHelper) return;
	  const stackHelper = rxx.rx.stackHelper;

	  if (event.delta > 0) {
	    if (stackHelper.index < stackHelper.orientationMaxIndex - 1) 
				stackHelper.index += 1;
	  } else if (stackHelper.index > 0)
				stackHelper.index -= 1;

  	rxx.borderROI.slice = stackHelper.slice;

	  // onGreenChanged();
	  // onRedChanged();
	  // onYellowChanged();
	}

	/**
	* Загрузка серии в QuadView и запуск рендеринга
	* @param {*} series AMI.SeriesModel
	*/ 
 	loadSeries(series) {
 		//console.log('QuadView::loadSeries()')
 		this.clear();
 		this._series = series;
		let stack = series.stack[0];
		this.ROI = new THREE.Box3(new THREE.Vector3(0,0,0), stack.dimensionsIJK.clone())
		// this.ROI.max.z = 1;
		//this.ROI.max.y = 50;
		this.dispatchEvent({type:'ROIChanged', value:this.ROI});

		for(let r of this.rxx) {	
			initHelpersStack(r.rx,stack);	// это функция из amiviwer.js надо от нее избавляться
	    r.borderROI = new ROIBorder(this.ROI, r.rx.stackHelper.slice)
  		r.rx.scene.add(r.borderROI);
  	}
  	// это взгляд на срез с другой стороны. 
  	// По какой-то причине рамка ROI видна только с одной стороны
  	//
  	this._r2.camera.invertColumns()

		this._r0.scene.add( this._r1.scene); this._r0.scene.add( this._r2.scene); this._r0.scene.add( this._r3.scene);
		let centerLPS = stack.worldCenter(); //, worldbb = stack.worldBoundingBox(); 
		this._r0.camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
		this._r0.camera.updateProjectionMatrix();
		this._r0.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);

		UP3.render('r0'); UP3.render('r1'); UP3.render('r2'); UP3.render('r3');

		// почему-то setNW работает только после вызова render()
		for(let r of this.rxx) {
			this.setNW(r);
			console.assert(r.NWSE[0] && r.NWSE[1], 'WN not null')
			//console.log(r.NWSE)
		}
		// console.log('traversing r0 scene..')
		// this._r0.scene.traverse( (obj) => console.log(obj))
 	}

 	// сюда приходит управление по кнопке из FakePanelComponent
 	initializeFFRProcessing() {
 		console.log('initializeFFRProcessing()')
 		const x0 = this.ROI.min.x, y0 = this.ROI.min.y, z0 = this.ROI.min.z
 		const x1 = this.ROI.max.x, y1 = this.ROI.max.y, z1 = this.ROI.max.z
 		const fullROI = new THREE.Box3(new THREE.Vector3(0,0,0), this._series.stack[0].dimensionsIJK);
 		const needResize = !this.ROI.equals(fullROI);
 		const msg = `ROI box [${x0},${y0},${z0} - (${x1},${y1},${z1})] `+(needResize ? "need resize" : "")
 		console.log(msg)
 		// seriesResize находится в ffrdriver.js
 		const rangeROI = [[x0,x1-1],[y0,y1-1],[z0,z1-1]]
 		//console.log('rangeROI',rangeROI, this.ROI)
 		//alert(msg);// return;

 		let series = (needResize ? seriesResize(this._series,rangeROI) : this._series)
 		if(!series) {
 			alert('series null')
 			return;
 		}

 		//_seriesFingerprint(series);
 		this._ffrDriver = new FFR__driver(this._FFRsrv, series); 
 		this._viewer.ffrDriver = this._ffrDriver;
 		this._ffrDriver.start()
 	}

	/**
	* Очистка QuadView и остановка рендеринга
	*/ 
 	clear() {
 		if(!this._series) return;
 		console.log('QuadView::clear()')

		this._r1.scene.remove(this._r1.stackHelper)
		this._r2.scene.remove(this._r2.stackHelper)
		this._r3.scene.remove(this._r3.stackHelper)


		// removeObject3D(this._r1.scene); this._r0.scene.remove(this._r1.scene)
		// removeObject3D(this._r2.scene); this._r0.scene.remove(this._r2.scene)
		// removeObject3D(this._r3.scene); this._r0.scene.remove(this._r3.scene)
		// removeObject3D(this._r0.scene)

		UP3.stopRender('r0'); UP3.stopRender('r1'); UP3.stopRender('r2'); UP3.stopRender('r3');

		this._series = null;

		// location.reload(); это действительно освобождает память
 	}

 	resize() {
 		// console.log('QuadView::resize()') 	
 		// console.trace();	
		// update 3D
		this._r0.camera.aspect = this._r0.domElement.clientWidth / this._r0.domElement.clientHeight;
		this._r0.camera.updateProjectionMatrix();
		this._r0.renderer.setSize(this._r0.domElement.clientWidth, this._r0.domElement.clientHeight);
		// console.log('this._r0.domElement',this._r0.domElement)
		
		// update 2d
		this.windowResize2D(this._r1);
		this.windowResize2D(this._r2);
		this.windowResize2D(this._r3);
		// console.log('this Element after resize', this.getElement())
 	}

	windowResize2D(rendererObj) {
		//console.log('windowResize2D rendererObj.domElement='); console.log(rendererObj.domElement);
		rendererObj.camera.canvas = {
			width: rendererObj.domElement.clientWidth,
			height: rendererObj.domElement.clientHeight,
		};
	    // поскольку элементы r[0123] могут быть "схлопнуты" при переключении 4-в-1
	    // их ширина и высота становится равной 0 и это вызывает ненужную диагностику
	    // "Invalid dimension provided" при вызове функции fitBox()
		if(rendererObj.domElement.clientWidth != 0 && this._series)
		    rendererObj.camera.fitBox(2, 1);
	  rendererObj.renderer.setSize(rendererObj.domElement.clientWidth, rendererObj.domElement.clientHeight);    
	    
	  // update info to draw borders properly
	  if(this._series) {
		  rendererObj.stackHelper.slice.canvasWidth  = rendererObj.domElement.clientWidth;	    
		  rendererObj.stackHelper.slice.canvasHeight = rendererObj.domElement.clientHeight;	   
		  // initHelpersLocalizer не вызывался, я не понимаю, что это такое 
		  // rendererObj.localizerHelper.canvasWidth 	 = rendererObj.domElement.clientWidth;	    
		  // rendererObj.localizerHelper.canvasHeight 	 = rendererObj.domElement.clientHeight;
		}
	    
	}

// 			Управление ROI
//

	resetROI() {
		if(this._series)
			this.ROI = new THREE.Box3(new THREE.Vector3(0,0,0), this._series.stack[0].dimensionsIJK.clone())
	}

	regionByEvent(event) {
		// event.target - это canvas
		const id = event.target.parentNode.id;
		return id == 'r1' ? this.rxx[0] : id == 'r2' ? this.rxx[1] : id == 'r3' ? this.rxx[2] : null;
	}

	/** @param {MouseEvent} event */
 	onMousedown(event) {
		//console.log(`quadview onMousedown`);
		let loc = this.locateEvent(event)
		// if(loc && loc.pointer)
		// 	console.log(`[${loc.pointer.x} ${loc.pointer.y} ${loc.pointer.z}]`)
		// const d = this.locationDistance(loc)
		// console.log(`[${d[0]},${d[1]},${d[2]},${d[3]},]`);

		// если схватить рамку нельзя, то уходим
		//
		if(!loc.dir) return;

		this.handle = loc; // или копия в момент mousedown ?

		// это имитация захвата верхней рамки r1, она управляет max.z
		// this.handle = {rxx: this.rxx[0], dir:new THREE.Vector3(0,0,1), cursor:'n-resize'};
		// this.handle = {rxx: this.rxx[0], dir:new THREE.Vector3(0,0,-1), cursor:'s-resize'};
		// this.handle = {rxx: this.rxx[0], dir:new THREE.Vector3(-1,0,0), cursor:'w-resize'};
		// this.handle = {rxx: this.rxx[0], dir:new THREE.Vector3(1,0,0), cursor:'e-resize'};
		//this.handle = {rxx: this.rxx[0], dir:new THREE.Vector3(-1,0,1), cursor:'nw-resize'};
		// this.handle = {rxx: this.rxx[1], dir:new THREE.Vector3(0,-1,0), cursor:'e-resize'};
		// this.handle = {rxx: this.rxx[1], dir:new THREE.Vector3(0,1,0), cursor:'w-resize'};
		//this.handle.rxx.rx.domElement.style.cursor = this.handle.cursor;
 	} 	

 		/** @param {MouseEvent} event */
 	onMouseup(event) {
 		// console.log('mouseup', this.handle)
 		if(!this.handle) return;
 		// отпуская рамку снова разрешаем PAN и ZOOM
		this.handle.rxx.rx.controls.enabled = true;
 		this.handle = null;
 	}


	/** @param {MouseEvent} event 
	 *  @return THREE.Vector3 ijk | null
	 */
 	hit(event, objects) {
 		if(!objects) return null;
		//console.log(`quadview hit`);
		const rxx = this.regionByEvent(event); 
		if(!rxx) return null;
    const rx = rxx.rx, scene = rx.scene, camera = rx.camera;
    const canvas = event.target.parentElement;	// это div вообще-то
    
    const raycaster = new THREE.Raycaster();
    var canvasOffset = getOffsetRect(canvas);
    const mouse = {
      x: ((event.clientX - canvasOffset.left) / canvas.clientWidth) * 2 - 1,
      y: - ((event.clientY - canvasOffset.top) / canvas.clientHeight) * 2 + 1,
    };

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);		
		//console.log('intersects.length='+intersects.length);
    if(intersects.length > 0) {
        //console.log("Hit @ " + toString( intersects[0].point) );
        //console.log(intersects[0].point.toString());
        const stackHelper = rx.stackHelper;
        let ijk =
          AMI.UtilsCore.worldToData(stackHelper.stack.lps2IJK, intersects[0].point);
        //console.log('IJK=');console.log(ijk);
        return ijk;
    }

    return null;
	}	

	/** @param {MouseEvent} event 
	 *  @return Locator {rxx, pointer, cursor, dir} | null
	 */
	locateEvent(event) {
		const loc = {rxx:null, pointer:null, cursor:'default', dir: null}
		loc.rxx = this.regionByEvent(event)
		if(!loc.rxx) return null;
		if(!this._series) return loc;
		loc.pointer = this.hit(event,loc.rxx.rx.scene.children)

		// определим близость к границам ROI box
		//
		const tolerance = 5;
		if(loc.pointer) {
			const dist = this.locationDistance(loc), distCorner = dist.map( (e,i,a) => Math.max(e,a[(i+1)%4]))
			for(let i=0; i<4; i++)
				if(distCorner[i] < tolerance) {
					loc.dir = loc.rxx.NWSE[i].clone().add(loc.rxx.NWSE[(i+1)%4]);
					loc.cursor = ['nw-resize', 'sw-resize', 'se-resize', 'ne-resize'][i];
					return loc;
				}
			for(let i=0; i<4; i++)
				if(dist[i] < tolerance) {
					loc.dir = loc.rxx.NWSE[i];
					loc.cursor = ['n-resize', 'w-resize', 's-resize', 'e-resize'][i];
					return loc;
				}
		}

		return loc;
	}

	/** @param {MouseEvent} event */
	onMousemove(event) {
		//console.log('onMousemove event',event)
		// 
		let loc = this.locateEvent(event);
		if(!loc || !loc.rxx || !loc.rxx.borderROI) return;

		// цвет надо менять только если попали внутрь рамки ROI
		loc.rxx.borderROI.color= this.locationInROI(loc) ? 0xFFFF00 : 0x00FF00;
		loc.rxx.rx.domElement.style.cursor = loc.cursor;

		if(!loc.pointer) return;

		if(this.handle) {
			// если схватили рамку, то надо запретить PAN и ZOOM
			loc.rxx.rx.controls.enabled = false;
			
			let box = this.ROI;

			if(this.handle.dir.x < 0) 			box.min.x = loc.pointer.x;				
			else if(this.handle.dir.x > 0)	box.max.x = loc.pointer.x;
			if(this.handle.dir.y < 0) 			box.min.y = loc.pointer.y;				
			else if(this.handle.dir.y > 0)	box.max.y = loc.pointer.y;
			if(this.handle.dir.z < 0) 			box.min.z = loc.pointer.z;				
			else if(this.handle.dir.z > 0)	box.max.z = loc.pointer.z;
				
			if(box.max.x <= box.min.x) box.max.x = box.min.x + 1;
			if(box.max.y <= box.min.y) box.max.y = box.min.y + 1;
			if(box.max.z <= box.min.z) box.max.z = box.min.z + 1;

			this.ROI = box;
		}
	}

	get ROI() {
		return this._ROI;
	}
	set ROI(ROI) {
		if(!this._series) return;	

		ROI.min.clamp(new THREE.Vector3(0,0,0),this._series.stack[0].dimensionsIJK)
		ROI.max.clamp(new THREE.Vector3(0,0,0),this._series.stack[0].dimensionsIJK)

		this._ROI = ROI;
		this.updateROIBorders();
		this.dispatchEvent({type:'ROIChanged', value:this.ROI});
	}

	updateROIBorders() {
		//console.log('updateROIBorders')
		for(let r of this.rxx)
			if(r.borderROI)
				r.borderROI.ROI = this.ROI;
	}

	locationInROI(loc) {
		if(!loc.rxx || !loc.rxx.borderROI || !loc.pointer) return false ;
		const box = new THREE.Box3().setFromArray(loc.rxx.borderROI["_geometry"].attributes.position["array"])
		return box.containsPoint(loc.pointer);
	}

	/** устанавливает, кем является северная и западная граница rxx - в соответствующей позиции X,Y или Z
	 *  будет поставлено -1 , если она управляет нижней точкой ROI, 1 - если верхней, иначе 0
	 *  @param {*} rxx  
	 *  @return {THREE.Vector3}
	 */
	setNW(rxx) {
    const rx = rxx.rx, scene = rx.scene, camera = rx.camera;
    const raycaster = new THREE.Raycaster();

    rxx.NWSE = [null, null, null, null]

    function diff(p2,p1,dir) {
    	let df = new THREE.Vector3().subVectors(p2,p1);
    	//console.log('df',df)
    	// отсекаем все меньше порога 1e-06
    	const eps = 1e-6;
    	if(Math.abs(df.x) < eps) df.x = 0
    	if(Math.abs(df.y) < eps) df.y = 0
    	if(Math.abs(df.z) < eps) df.z = 0
    	if(df.x != 0) {
    		df.x = Math.sign(df.x); 
    		const cond = (df.y == 0 && df.z == 0)
    		console.assert(cond, `не орто x`)
    		if(!cond) {
    			console.log(`${rx.id}.${dir} (${df.x} ${df.y} ${df.z})`)
    		}
    	}
    	if(df.y != 0) {
    		df.y = Math.sign(df.y); 
    		const cond = (df.x == 0 && df.z == 0)
    		console.assert(cond, `не орто y`)
    		if(!cond) {
    			console.log(`${rx.id}.${dir} (${df.x} ${df.y} ${df.z})`)
    		}
    	}
    	if(df.z != 0) {
    		df.z = Math.sign(df.z);
    		const cond = (df.x == 0 && df.y == 0)
    		console.assert(cond, `не орто z`)
    		if(!cond) {
    			console.log(`${rx.id}.${dir} (${df.x} ${df.y} ${df.z})`)
    		}
    	}
    	return df;
    }

    raycaster.setFromCamera({x:0, y:0}, camera);
    var intersects = raycaster.intersectObjects(scene.children, true);
    //console.log('(0,0) intersects.length='+intersects.length);
		let p00 =  intersects[0].point.clone();	// да, без проверки  intersects.length 
		//console.log('p00',p00)
		raycaster.setFromCamera({x:0, y:0.5}, camera);
		intersects = raycaster.intersectObjects(scene.children, true);
    if(intersects.length > 0) rxx.NWSE[0] = diff(intersects[0].point,p00,'N');
    //console.log('p North',intersects[0].point,rxx.NWSE[0])
    raycaster.setFromCamera({x:-0.2, y:0}, camera);
    intersects = raycaster.intersectObjects(scene.children, true);
    if(intersects.length > 0) rxx.NWSE[1] = diff(intersects[0].point,p00,'W');
    rxx.NWSE[2] = rxx.NWSE[0].clone().negate();
    rxx.NWSE[3] = rxx.NWSE[1].clone().negate();
	}

	/** возвращает массив с расстояниями до границ NWSE 
	 *  @param {*} loc  
	 *  @return {Array<Number>} [4] расстояния до границ NWSE или [Inf], если вне ROI
	 */
	locationDistance(loc) {
		//console.log('locationDistance',loc)
		const _this = this

		function distToBorder(loc,i) {
			if(!_this.locationInROI(loc)) return +Infinity;						
			//const dd = [loc.rxx.N, loc.rxx.W, loc.rxx.N.clone().negate(), loc.rxx.W.clone().negate()]
			const d = loc.rxx.NWSE[i]
			if(d.x) return Math.abs(loc.pointer.x - (d.x < 0 ? _this.ROI.min.x : _this.ROI.max.x))
			if(d.y) return Math.abs(loc.pointer.y - (d.y < 0 ? _this.ROI.min.y : _this.ROI.max.y))
			if(d.z) return Math.abs(loc.pointer.z - (d.z < 0 ? _this.ROI.min.z : _this.ROI.max.z))
			return +Infinity
		}

		return [distToBorder(loc,0), distToBorder(loc,1), distToBorder(loc,2), distToBorder(loc,3)]		
	}
}


class ROIBorder extends AMI.BorderHelper {
  /** 
   * @param {THREE.Box3} roiBox
   * @param {AMI.SliceHelper} sliceHelper
   */
	constructor(roiBox, sliceHelper) {
		// делаем имитацию sliceHelper, геометрия которого определяется ROI box'ом, а не slice

  	let sliceROI = {
  		geometry: sliceHelper.geometry,
  		"aabbSpace": 'IJK',
  		stack: sliceHelper.stack,
  	}

		super(sliceROI/*sliceHelper*/)
		this._slice = sliceHelper
		this._ROI = roiBox;
    this.color = 0x00FF00;
    this._material = new THREE.LineDashedMaterial({
      color: 0x00FF00,
      dashSize:9,
      "gapSize":5,
      //linewidth: 5,
      //scale:3,
    });
    // this._material.side = THREE.FrontSide; //  BackSide
    this._update();
	}

	set ROI(ROI) {
		this._ROI = ROI;
		this._update();
	}
	get ROI() {
		return this._ROI;
	}

	set slice(slice) {
		this._slice = slice;
		this._update();
	}

  // есть временной лаг при подсвечивании рамки
  // но причина его непонятна. Сеттер делу не помог
  //
	// set color(color) {
	// 	//console.log('set color')
	// 	super.color = color;
	// 	this._update();
	// 	if(this._mesh && this._mesh.geometry)
	// 		this._mesh.geometry.attributes.color['needsUpdate'] = true;
	// }

	_update() {
  	const slice = this._slice
		const pos = slice["planePosition"], dir = slice["planeDirection"]
  	//console.log('slice vertices',slice.geometry.vertices,slice)

		let aabb = {
			halfDimensions: this.ROI.getSize(new THREE.Vector3()).multiplyScalar( 0.5 ),
			center: this.ROI.getCenter(new THREE.Vector3())/*.subScalar(-0.5)*/,
			"toAABB": new THREE.Matrix4(),
		};
		let plane = {
			position: new THREE.Vector3(pos.x, pos.y , pos.z),
			direction: new THREE.Vector3(dir.x, dir.y, dir.z)
		}
		//console.log('aabb plane', aabb, plane)
  	let intersections = AMI.IntersectionsCore.aabbPlane(aabb,plane);
  	//console.log('intersections',intersections)
  	//if(intersections.length == 0 ) return;
  	this.helpersSlice.geometry = (intersections.length == 0 ) ? [] :
													  		new AMI.SliceGeometry(aabb.halfDimensions,aabb.center,
													  			plane.position, plane.direction)

		super._update();	
		if((intersections.length != 0 ))											  	
    	this._mesh.computeLineDistances();		
	}
}

// Домаскин-300 == Домаскин-856 с диапазоном [61,size 301] ?
// Fingerprint: dims, spacing, сумма всех вокселей, frame[0 и last].positions
function _seriesFingerprint(series) {
	const stack = series.stack[0],  dims = stack.dimensionsIJK, spacing = stack._spacing
	const m1 = `dims=[${dims.x},${dims.y},${dims.z}]`
	const m2 = `spacing=(${spacing.x.toFixed(3)},${spacing.y.toFixed(3)},${spacing.z.toFixed(3)}})`
	let sum = 0
	for(let z=0;z<dims.z;z++)
		for(let y=0;y<dims.y;y++)
			for(let x=0;x<dims.x;x++)
				sum += AMI.UtilsCore.getPixelData(stack, {x:x, y:y, z:z});
	const m3 = `sum=${sum}`

	const p0 = stack.frame[0].imagePosition, p1 = stack.frame[dims.z-1].imagePosition 
	console.log(m1, m2, m3, p0, p1)
}

// рекурсивно удаляет всех потомков объекта
//
function removeObject3D(obj){
  if (!(obj instanceof THREE.Object3D)) return false;

  while(obj.children.length > 0){ 
    removeObject3D(obj.children[0]);
    obj.remove(obj.children[0]);
  }
  if(obj.geometry) obj.geometry.dispose();

  if(obj.material){ 
    //in case of map, bumpMap, normalMap, envMap ...
    Object.keys(obj.material).forEach(prop => {
      if(!obj.material[prop])
        return;
      if(obj.material[prop] !== null && typeof obj.material[prop].dispose === 'function')                                  
        obj.material[prop].dispose();                                                      
    })
    obj.material.dispose();
  }

  // remove from parent
	// if ( ( obj && obj.isObject3D ) ) {

	// 	if ( obj.parent !== null ) {

	// 		obj.parent.remove( obj );
	// 	}
	// }
}   
