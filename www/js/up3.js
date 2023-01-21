const rx = {
	id: '',					// это имя в системе UP3
	domId: undefined,	
	domElement: null,		// HTMLElement
	renderer: null,
	color: 0x212121,
	targetID: 0,
	camera: null,
	controls: null,
	scene: null,
	light: null,
	stackHelper: null,
	// localizerHelper: null,
	// localizerScene: null,
	dicomInfo: null,          // ссылка на объект класса DicomInfo
	boxHelper:null,           // надо для dispose
	stack:null,
	render:null,			// custom render() function

	// true, если для данного элемента работает стандартная UP.render()
	// при внешнем рендеринге этот флаг должен выставляться вручную
	rendered: false,
	// этот флаг разрещает стандартный UP3.render()
	enabledStandardRendering: true,	

	// вторая сцена и камера используется PlasticBoy для рендеринга LUT
	scene2:  null,
	camera2: null,
	light2: null,	// light2 добавляется к scene2 самим PlasticBoy

};	


var UP3 = {
	create: function() {
		return Object.assign({},rx);
	},

	enable: function(element) {
		let newElement = UP3.getEnabledElement(element,false);
		if(!newElement) {
			// console.log('UP3::enable()', element)
			UP3.data.push(Object.assign({},rx));
			newElement = UP3.data[UP3.data.length-1];
			if(typeof element === 'string') {
				newElement.id = element;
				newElement.domElement = document.getElementById(element);
			}
			else {
				newElement.domElement = element;
				newElement.id = element.id;
			}
		}
				
		return newElement;
	},

	isEnabled: function(element) {
		return UP3.getEnabledElement(element,false) !== null;
	},

	initRenderer3D: function(element) {
		let renderObj = UP3.getEnabledElement(element,true);
		
		// renderer
		// renderObj.domElement = document.getElementById(renderObj.domId);
		renderObj.renderer = new THREE.WebGLRenderer({
		antialias: true,
		});
		renderObj.renderer.setSize(
		renderObj.domElement.clientWidth, renderObj.domElement.clientHeight);
		renderObj.renderer.setClearColor(renderObj.color, 1);
		renderObj.renderer.domElement.id = renderObj.targetID;
		renderObj.domElement.appendChild(renderObj.renderer.domElement);

		// camera
		renderObj.camera = new THREE.PerspectiveCamera(
		45, renderObj.domElement.clientWidth / renderObj.domElement.clientHeight,
		0.1, 100000);
		renderObj.camera.position.x = 500;
		renderObj.camera.position.y = 500;
		renderObj.camera.position.z = -500;

		// controls
		renderObj.controls = new AMI.TrackballControl(
		renderObj.camera, renderObj.domElement);
		renderObj.controls.rotateSpeed = 5.5;
		renderObj.controls.zoomSpeed = 1.2;
		renderObj.controls.panSpeed = 0.8;
		renderObj.controls.staticMoving = true;
		renderObj.controls.dynamicDampingFactor = 0.3;

		// scene
		renderObj.scene = new THREE.Scene();

		// light
		renderObj.light = new THREE.DirectionalLight(0xffffff, 1);
		renderObj.light.position.copy(renderObj.camera.position);
		renderObj.scene.add(renderObj.light);
	},

	initRenderer2D: function(element) {
		let rendererObj = UP3.getEnabledElement(element,true);

		// renderer
		// rendererObj.domElement = document.getElementById(rendererObj.domId);
		rendererObj.renderer = new THREE.WebGLRenderer({
		antialias: true,
		});
		rendererObj.renderer.autoClear = false;
		rendererObj.renderer.localClippingEnabled = true;
		rendererObj.renderer.setSize(
		rendererObj.domElement.clientWidth, rendererObj.domElement.clientHeight);
		rendererObj.renderer.setClearColor(0x121212, 1);
		rendererObj.renderer.domElement.id = rendererObj.targetID;
		rendererObj.domElement.appendChild(rendererObj.renderer.domElement);

		// camera
		rendererObj.camera = new AMI.OrthographicCamera(
		rendererObj.domElement.clientWidth / -2,
		rendererObj.domElement.clientWidth / 2,
		rendererObj.domElement.clientHeight / 2,
		rendererObj.domElement.clientHeight / -2,
		1, 1000);

		// controls
		rendererObj.controls = new AMI.TrackballOrthoControl(
		// rendererObj.controls = new UITrackballOrthoContol(
		rendererObj.camera, rendererObj.domElement);
		rendererObj.controls.staticMoving = true;
		rendererObj.controls.noRotate = true;
		rendererObj.camera.controls = rendererObj.controls;

		// scene
		rendererObj.scene = new THREE.Scene();
	},

	getEnabledElement: function(element,mustExist) {
		let prop = (typeof element === 'string' ? "id" : "domElement");
		for(let i=0; i<UP3.data.length; i++)
			if(UP3.data[i][prop] === element)
				return UP3.data[i];
		if (mustExist) 
			throw new Error('getEnabledElement: can not find element '+element);
		
		return null;
	},

	render: function(element) {
		let renderObj = UP3.getEnabledElement(element,true);

		if(renderObj.render) {
			renderObj.render(renderObj);
			return;
		}

	    const controls = renderObj.controls, renderer = renderObj.renderer
	    const scene = renderObj.scene, camera = renderObj.camera

	    function render() {
		  renderer.clear();
		  if(!renderObj.enabledStandardRendering) {
		  	console.log('stoped UP3.render()')
		  	return;
		  }
	      requestAnimationFrame(render);
	      controls.update();
	      renderer.render(scene, camera);

	      // это для LUT
          if(renderObj.scene2) {
            renderer.autoClear = false;
            renderer.render( renderObj.scene2, renderObj.camera2 );
          }

	    }

	    renderObj.rendered = true;
	    renderObj.enabledStandardRendering = true;
	    render();
	},

	stopRender: function(element) {
		let renderObj = UP3.getEnabledElement(element,true);
		if(renderObj)	renderObj.enabledStandardRendering = false;		
	},

	setRenderFunction: function(element, f) {
		let renderObj = UP3.getEnabledElement(element,true);
		renderObj.render = f;
	},

	// AMI.{ModelStack ModelSeries ModelFrame} не имеют dispose()
	// THREE.WebGLRenderer AMI.TrackballOrthoContol имеют
	//
	disable: function(element) {
		let rx = UP3.getEnabledElement(element,true);
		if(!rx) return;

		// какие-то объекты требуют dispose, THREE.Scene - рекурсивного удаления, но пока пусть будет по простому
		if(rx.renderer) rx.renderer = null;
		if(rx.camera) 	rx.camera = null;
		if(rx.controls) rx.controls = null;
		if(rx.scene) 	rx.scene = null;
		if(rx.light) 	rx.light = null;
		if(rx.boxHelper) rx.boxHelper = null;
		if(rx.stack) rx.stack = null;
		for(var i=0; i<UP3.data.length; i++)
			if(UP3.data[i] == rx) {
				UP3.data.splice(i,1);
				break;
			}
		// if(rx.hasOwnProperty('_seriesInstanceUID') &&)
	},

	data: [],

};
window['UP3'] = UP3;

