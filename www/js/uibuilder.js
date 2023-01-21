/** Этот файл отвечает за построение  всех диалогов и прочих UI компонент проекта FFR
 * Реализованы Dialog-1,2,8,10
*/

goog.require('goog.ui.Dialog.ButtonSet');
goog.require('goog.style');
goog.require('goog.math.Size');
goog.require('gfk.ui.Dialog');
goog.require('gfk.ui.TabBar');
goog.require('gfk.ui.SplitPane');
goog.require('gfk.ui.Slider');
goog.require('goog.ui.tree.TreeControl');
goog.require('goog.ui.Checkbox');
goog.require('goog.ui.Checkbox.State');

function s(v) {
   return "(" + v.x.toFixed(2) + ", " + v.y.toFixed(2) + ", " + v.z.toFixed(2) + ")";
}

class DummyControls {
  constructor() {
    this.target = new THREE.Vector3();
  }
  update() { /*console.log('DummyControls::update()')*/ }
  handleResize() { /*console.log('DummyControls::handleResize()')*/ }
}

// Dialog-1: Диалог подтверждения, что DICOM dir найдена 
//
class Dialog1 {
	constructor() {
	    console.log('new FFR.Dialog1()')
	    this.dialog = new gfk.ui.Dialog();
	    this.dialog.setContentBackground('#fff');
	    this.dialog.setContent('<div><img src="img/q.png"/>DICOMDIR файл найден. Использовать его?</div>');
	    this.dialog.setTitle('DICOM');
	    this.dialog.setTitleBackground('#fff');
      let buttonSet = new goog.ui.Dialog.ButtonSet();
      buttonSet.addButton({caption:'Да', key:'OK'},true); // default
      buttonSet.addButton({caption:'Нет', key:'CANCEL'},false,true); // cancel
      this.dialog.setButtonSet(buttonSet);

	}

	exec(f) {
		this.dialog.listen(e => f(e.key));
		this.dialog.show();
	}
 }

// Dialog-2: DICOM-каталог
//
class Dialog2 {
  constructor() {
    this.dialog = new gfk.ui.Dialog();
    this.dialog.setTitle("DICOM-каталог");
    this.dialog.setSize(600,500);
    this.dialog.setContentBackground('#fff');
    this.dialog.setTitleBackground('#fff');
    let buttonSet = new goog.ui.Dialog.ButtonSet();
    buttonSet.addButton({caption:'ОК', key:'OK'},true); // default
    buttonSet.addButton({caption:'Отмена', key:'CANCEL'},false,true); // cancel
    buttonSet.addButton({caption:'Выбрать все', key:'ALL'},false,true); // select all
    this.dialog.setButtonSet(buttonSet);

    this.dialog.show();
    let component = this.dialog.dialog;
    var content = component.getContentElement();
    goog.style.setStyle(content,'padding','0px');
    var contentSize = goog.style.getSize(content);

    let splitControl = new gfk.ui.SplitPane();
    splitControl.render(content);
    splitControl.setSize(contentSize,contentSize.width/2);
    let lhsElement = splitControl.splitpane.getElementByClass('goog-splitpane-first-container');

    // создаем тестовое дерево
    var tree = new goog.ui.tree.TreeControl('root');
    
    
    var testData = [
      'A',
      [['AA', [['AAA', []], ['AAB', []]]], ['AB', [['ABA', []], ['ABB', []]]]]
    ];

    createTreeFromTestData(tree, testData, 3);
    //tree.setShowRootNode( false );
    tree.render(lhsElement);

    // добавляем чекбоксы https://stackoverflow.com/questions/2653793/google-closure-library-adding-non-treenode-children-to-a-treenode/16364410
    let ref = tree.getChildAt(0);
    let cb = new goog.ui.Checkbox( goog.ui.Checkbox.State.CHECKED);
    console.log('ref before',ref)
    cb.renderBefore( ref.getLabelElement() );
    //tree.expandAll();
    //tree.collapseAll();

    tree.listen('change',function(e) {
      console.log('tree=',tree)
      let item = tree.getSelectedItem();
      console.log('three.getSeletedItem()=',item);
    });


    function createTreeFromTestData(node, data, maxLevels) {
      node.setText(data[0]);
      if (maxLevels < 0) {
        return;
      }

      var children = data[1];
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        var childNode = node.getTree().createNode('');
        node.add(childNode);
        createTreeFromTestData(childNode, child, maxLevels - 1);
      }
    }

  }

  exec(f) {
    this.dialog.listen(e => f(e.key));
    this.dialog.show();
  }
}

// Dialog-12: Vessel Inspector
// mainSplitControl                 - горизонтальный SplitPane диалога {lhsElement,rhsElement}
//   rhsSplitControl                - mainSplitControl.rhs {lhsElement1,rhsElement1}
//                      rhsElement1 - это правый нижний угол (D12_lower_right)
//      urSplitControl  lhsElement1 - это сплиттер в правой верхней части {lhsElement3,rhsElement3}
//   lhsSplitControl                 - mainSplitControl.lhs {lhsElement2,rhsElement2}
// 
// r[456] и r[789]
// 
// 
// stack: AMI.ModelsStack
// aortaMask: Cube Uitn8
// vesselMask[] of Cube Uitn8       --0 left  1 right?
// vesselInfo[] of {string name,Float64Array burificationPoints[], Float64Array centerline[]}
//
class Dialog12 {
  constructor(stack, aortaMask, vesselMask, vesselInfo) {
      console.log('new FFR.Dialog12()-3',stack)
      this.dialog = new gfk.ui.Dialog();
      this._stack = stack;
      this._aortaMask = aortaMask;
      this._vesselMask = vesselMask;
      this._vesselInfo = vesselInfo;
      // заполняется в makeAortaAndVesselsMesh()
      this._selectedVessel = 4;     // индекс в _vesselInfo выбранного для отладки сосуда
      this.v0Mesh = null;
      this.v1Mesh = null;
      this.aortaMesh = null;
      this.positions = null;        // это centerline выбранного сосуда, лучше было бы так и назвать
      this.vessel4 = null;          // THREE.Mesh; 4 - это _selectedVessel
      this.axControl = null;

      this._stenosis = {
        id: -1,   // -1 означает информация не заполнена
        color: new THREE.Color(0x00ff00),
        // начальная и конечная секущая плоскости, определяюший положение стеноз. pos - это точка на центральной линии сосуда
        start:{ pos: new THREE.Vector3(), normal: new THREE.Vector3()},     
        end:  { pos:new THREE.Vector3(), normal: new THREE.Vector3()},
        vesselInd: undefined, // vesselInfo index
        vesselMesh: null,     // меш сосуда на котором ставится стеноз. Это либо v0Mesh, либо v1Mesh
        faces: [],            // индексы граней сосуда, которые промаркированы как стеноз
      }
      this.r7orto = null;     // используется в R8
      this.r4 = {};           // используется в makeR4
      this.cameraHelperR4 = null;

      let verbose = true;
      if(verbose) {
        console.log('stack.frames['+this._stack.frame.length+'] ',this._aortaMask.toString())
        console.log(this._vesselMask[0].toString())
        console.log(this._vesselMask[1].toString())
        console.log('vesselInfo', this._vesselInfo)
      }

      this.dialog.setTitle("Анализ сосуда"); 
      this.dialog.setSize(800,400);
      this.dialog.show();
      let component = this.dialog.dialog;
      component.setModal(false);

      var element = component.getContentElement(); //console.log('element',element)      
      //console.log('element size',goog.style.getSize(element))
      //this.log(element)

      var content = this.dialog.dialog.getContentElement()
      goog.style.setStyle(content,'padding','0px');
      goog.style.setStyle(this.dialog.dialog.getElement(),'z-index','3');

      var mainSplitControl = new gfk.ui.SplitPane();
      mainSplitControl.render(content);
      let lhsElement = mainSplitControl.splitpane.getElementByClass('goog-splitpane-first-container');
      let rhsElement = mainSplitControl.splitpane.getElementByClass('goog-splitpane-second-container');
      goog.style.setStyle(lhsElement, 'border', '0px solid black');
      goog.style.setStyle(rhsElement, 'border', '0px solid black');
      mainSplitControl.setSize(new goog.math.Size(800,400),600)
      let mainRhsSize = mainSplitControl.getRhsSize();
      let rhsSize = goog.style.getSize(rhsElement);
      let rhsSplitControl = new gfk.ui.SplitPane('vertical');
      rhsSplitControl.render(rhsElement);
      rhsSplitControl.setSize(rhsSize,rhsSize.height/2)
      let lhsElement1 = rhsSplitControl.splitpane.getElementByClass('goog-splitpane-first-container');
      let rhsElement1 = rhsSplitControl.splitpane.getElementByClass('goog-splitpane-second-container');
      goog.style.setStyle(lhsElement1, 'border', '0px solid black');
      goog.style.setStyle(rhsElement1, 'border', '0px solid black');

      let lhsSplitControl = new gfk.ui.SplitPane('vertical');
      lhsSplitControl.render(lhsElement);
      let lhsSize = goog.style.getSize(lhsElement);
      //console.log('lhsElement',lhsElement)
      //console.log('lhsSize',lhsSize)
      lhsSplitControl.setSize(lhsSize,lhsSize.height/2)
      let lhsElement2 = lhsSplitControl.splitpane.getElementByClass('goog-splitpane-first-container');
      let rhsElement2 = lhsSplitControl.splitpane.getElementByClass('goog-splitpane-second-container');
      goog.style.setStyle(lhsElement2, 'border', '0px solid black');
      goog.style.setStyle(rhsElement2, 'border', '0px solid black');
      //console.log('lhsElement2',lhsElement2)
      //console.log('rhsElement2',rhsElement2)
      goog.style.setStyle(rhsElement2, {'display': 'flex', 'flex-direction': 'column'})

      let tabBar = new gfk.ui.TabBar(rhsElement2,['Измерения','Цветовая Карта', 'FFR Marks']);
      // это div id в теле tab0HTML
      let tab0DivId = component.makeId('tb');   

var tab0HTML = 
`<div style="display:flex; height:100%;">
  <div style="width:50%; height:100%;">
    <div style="height:50%;background:#999">
                Use the keyboard or the mouse to switch tabs.
    </div>
    <div style="height:50%; ">
    <fieldset>
      <legend>Пороги детектора</legend>
      Mин <input type="number" value="160" id="number1" style="width: 6em;"/> 
      Макс <input type="number" value="560" id="number2" style="width: 6em;"/>
    </fieldset>
    </div>
  </div>
  <div  id="${tab0DivId}" style="width:50%; height:100%; background:#777;"></div>
</div>`
      tabBar.setTabContent(0,tab0HTML);
      tabBar.setTabContent(1,tab1HTML);
      tabBar.setTabContent(2,tab2HTML);
      tabBar.setSelectedTabIndex(0);
      let tab0Div = document.getElementById(tab0DivId); //console.log('tab0Div=',tab0Div);
      
      // формируем lower-right часть
      let D12_select_options = '';//'<option>Left vessel: ABC</option>\n<option>Left vessel: ABC</option>';
      for(var i=0; i<this._vesselInfo.length; i++)
        D12_select_options += '<option>'+this._vesselInfo[i].name+'</option>\n';
var D12_lower_right =     
 `<div style="height:100%; background:#ddd; display:flex; flex-direction:column; justify-content:space-between;">
     <select style="width:100%; margin:5px 0px 5px 0px;"><option>Edit</option><option>Change label</option></select>
  <select size="8">
  "${D12_select_options}"
  </select>
   <button style="width:100%">Удалить сосуд</button>
 </div>`

      rhsElement1.innerHTML = D12_lower_right;

      // формируем upper-right часть: в ней будет находится urSplitControl с DOM элементами (lhsElement3,rhsElement3)
      // placeholder для urSplitControl lhsElement1
      let urSize = goog.style.getSize(lhsElement1);
      let urSplitControl = new gfk.ui.SplitPane('vertical');
      urSplitControl.render(lhsElement1);
      urSplitControl.setSize(urSize,urSize.height * 0.6);
      let lhsElement3 = urSplitControl.splitpane.getElementByClass('goog-splitpane-first-container');
      this.lhsElement3 = lhsElement3;
      let rhsElement3 = urSplitControl.splitpane.getElementByClass('goog-splitpane-second-container');
      var urLowerHtml =
      `<div style="display:flex; justify-content:space-between; margin:5px;">
        <input type="number" value="0.0" step="0.1" style="width: 6em;"/>
        <select><option>MIP</option><option>MinIP</option><option>MAP</option></select></div>
      <div style="display:flex; justify-content:space-between; margin:5px;">
        Scale <button>Smaller</button><button>Larger</button></div>`
      urSplitControl.setRhsHTMLContent(urLowerHtml);
      goog.style.setStyle(lhsElement3, 'border', '0px solid red');
      goog.style.setStyle(lhsElement3, 'overflow', 'hidden');
      // goog.style.setStyle(lhsElement3, 'padding', '0px');
      // goog.style.setStyle(lhsElement3, 'box-sizing', 'padding-box');
      // goog.style.setStyle(lhsElement3, 'margin', '0px');
      goog.style.setStyle(rhsElement3, 'border', '0px solid black');

      // формируем upper-left часть: в ней  будет находится ulSplitControl с DOM элементами (lhsElement4,rhsElement4)
      // placeholder для urSplitControl lhsElement2
      //console.log('lhsElement2=',lhsElement2)
      let ulSize = goog.style.getSize(lhsElement2);
      let ulSplitControl = new gfk.ui.SplitPane('vertical');
      ulSplitControl.render(lhsElement2);
      ulSplitControl.setSize(ulSize,ulSize.height/2);
      this.lhsElement4 = ulSplitControl.splitpane.getElementByClass('goog-splitpane-first-container');
      this.lhsElement4.id = component.makeId('r4');
      this.rhsElement4 = ulSplitControl.splitpane.getElementByClass('goog-splitpane-second-container');
      this.rhsElement4.id = component.makeId('r5');
      goog.style.setStyle(this.lhsElement4, 'border', '0px solid black');
      goog.style.setStyle(this.rhsElement4, 'border', '0px solid black');

      // формирование правой половины tab0HTML
      // placeholder правой половины - tab0Div В нем будет таходится splitControl5 c DOM {lhsElement5, rhsElement5}
      let size5 = goog.style.getSize(tab0Div);
      let splitControl5 = new gfk.ui.SplitPane();
      splitControl5.render(tab0Div);
      splitControl5.setSize(size5,size5.width/2);
      let lhsElement5 = splitControl5.splitpane.getElementByClass('goog-splitpane-first-container');
      let rhsElement5 = splitControl5.splitpane.getElementByClass('goog-splitpane-second-container');
      goog.style.setStyle(lhsElement5, 'border', '0px solid black');
      goog.style.setStyle(rhsElement5, 'border', '0px solid black');

      // помещаем вертикальрный сплиттер splitControl6 c DOM {lhsElement6, rhsElement6}
      // в левую половину splitControl5
      let size6 = goog.style.getSize(lhsElement5);
      //console.log('size6=',size6)
      let splitControl6 = new gfk.ui.SplitPane('vertical');
      splitControl6.render(lhsElement5);
      splitControl6.setSize(size6,size6.height/2);
      let lhsElement6 = splitControl6.splitpane.getElementByClass('goog-splitpane-first-container');
      let rhsElement6 = splitControl6.splitpane.getElementByClass('goog-splitpane-second-container');
      goog.style.setStyle(lhsElement6, 'border', '0px solid black');
      goog.style.setStyle(rhsElement6, 'border', '0px solid black');

      
      // this.makeR6();
      // this.loadAndRenderQuadView();
      this.makeR8();
      //this.laplacianSmooting();
  } 

  exec(f) {
    this.dialog.listen(e => f(e.key));
    this.dialog.show();
  }

  laplacianSmooting() {
    console.log('Эксперименты по сглаживанию Лапласа')
    // let positions = this._aortaMask.marchingCubes();
    // let vertices = [];
    // for ( var i = 0; i < positions.length; i += 3 ) {
    //   vertices.push( new THREE.Vector3().fromArray( positions, i ) );
    // }
    // console.log('vertices',vertices);

    let geometry = new THREE.Geometry().fromBufferGeometry(this._aortaMask.geometry());
    // console.log('geometry',geometry);
    let aortaMesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide }));
      

  }

  makeAortaAndVesselsMesh() {
      console.log('makeAortaAndVesselsMesh()')
      let IJK2LPS = this._stack.ijk2LPS;
      let aortaMesh = new THREE.Mesh(this._aortaMask.geometry(), 
        new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide }));
      let v0Mesh = new THREE.Mesh(this._vesselMask[0].geometry(), 
        new THREE.MeshLambertMaterial( { color: 0xf80100, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
      let v1Geomerty = this._vesselMask[1].geometry();
      console.log('v1Geomerty',v1Geomerty)
      const positionAttribute = v1Geomerty.getAttribute( 'position' );
      const vertsNum = positionAttribute.count; 
      let vesselColor = new THREE.Color(0xd28e0c);
      let colors = new Float32Array(vertsNum*3)
      for(var  i=0; i<vertsNum; i++) {
        colors[3*i+0] = vesselColor.r; 
        colors[3*i+1] = vesselColor.g; 
        colors[3*i+2] = vesselColor.b; 
      }
      v1Geomerty.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
      let v1Mesh = new THREE.Mesh(v1Geomerty, 
        new THREE.MeshBasicMaterial( { /*color: 0xd28e0c,*/ side: THREE.DoubleSide, transparent: true, opacity: 0.5,
        'vertexColors': THREE.VertexColors   }));
      // console.log('v1Mesh.geometry',v1Mesh.geometry)  

      aortaMesh.applyMatrix(IJK2LPS);
      v0Mesh.applyMatrix(IJK2LPS);
      v1Mesh.applyMatrix(IJK2LPS);
      this.v0Mesh = v0Mesh;
      this.v1Mesh = this.smoothMesh(v1Mesh,1); 

      this.aortaMesh = aortaMesh;

      // let origin = new THREE.Vector3(-53.7033, -134.172, -927), scale = new THREE.Vector3(0.405, 0.405, 1);
      // http://localhost/three.js-master/examples/misc_exporter_gltf.html
      // ---------------------------------------------------------------------
      // THREE.Line Strip
      // ---------------------------------------------------------------------
      var geometry = new THREE.BufferGeometry();
      // Float64Array[] -> Float32Array[]
      let data = this._vesselInfo[this._selectedVessel].centerline;
      let positions = new Float32Array(data.length);
      for(let i=0; i<data.length; i++)
        positions[i] = data[i];
      this.positions = positions;
      var numPoints = positions.length/3;
      geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
      let object = new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xffffff } ) );
      this.vessel4 = object;
  }

  addAortaAndVesselsToQuadView() { 
    this.makeAortaAndVesselsMesh();
    r0.scene.add(this.aortaMesh);      
    r0.scene.add(this.v0Mesh);      
    r0.scene.add(this.v1Mesh);      
    // уберем коробочку и плосктси в R0, чтобв не мешало
    r0.scene.remove(r1.scene);
    r0.scene.remove(r2.scene);
    r0.scene.remove(r3.scene);
    r0.scene.add( this.vessel4 );
  }

  loadAndRenderQuadView() {
    initAMI();  
    initHelpers(this._stack);
    let centerLPS = this._stack.worldCenter();
    r0.camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
    r0.camera.updateProjectionMatrix();
    r0.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);
    r1.controls.setStateExtended(STATE.ROTATE);
    r2.controls.setStateExtended(STATE.ROTATE);
    r3.controls.setStateExtended(STATE.ROTATE);

    this.addAortaAndVesselsToQuadView();
    this.renderQuadView();

    r0.domElement.addEventListener('dblclick', (e)=>{
        console.log('onDoubleClickR0')  //this.onDoubleClickR0(e)
        toggle_1or4_windows(r0.domElement);
      });

  }

 renderQuadView() {
  let self = this;
  function render() {
    r0.controls.update();
    r1.controls.update();
    r2.controls.update();
    r3.controls.update();
    if(self.cameraHelperR4) self.cameraHelperR4.update();

    r0.renderer.render(r0.scene, r0.camera);

    r1.renderer.clear();
    r1.renderer.render(r1.scene, r1.camera);
    r1.renderer.clearDepth();
    r1.renderer.render(r1.localizerScene, r1.camera);

    r2.renderer.clear();
    r2.renderer.render(r2.scene, r2.camera);
    r2.renderer.clearDepth();

    // data.forEach(function(object, key) {
    //   object.materialFront.clippingPlanes = [clipPlane2];
    //   object.materialBack.clippingPlanes = [clipPlane2];
    // });
    r2.renderer.render(sceneClip, r2.camera);
    r2.renderer.clearDepth();
    r2.renderer.render(r2.localizerScene, r2.camera);

    r3.renderer.clear();
    r3.renderer.render(r3.scene, r3.camera);
    r3.renderer.clearDepth();

    // data.forEach(function(object, key) {
    //   object.materialFront.clippingPlanes = [clipPlane3];
    //   object.materialBack.clippingPlanes = [clipPlane3];
    // });
    r3.renderer.render(sceneClip, r3.camera);
    // localizer
    r3.renderer.clearDepth();
    r3.renderer.render(r3.localizerScene, r3.camera);
  }

  function animate() {
    render();
    // request new frame
    requestAnimationFrame(function() {
      animate();
    });
  }

  console.log("start animation");
  animate();
 }

  // Это эксперименты по виртуальной эндоскопии, когда камера помещега внутрь сосуда и движется по его центральной лирнии
  //
  makeR4() {
      //-----------------------------
      // формируем r4
      //-----------------------------      
      console.log('Dialog-12::makeR4() виртуальная эндоскопия')

      let huvR4 = new HUV({left:300, top:200, width:600, height:600, opacity:1});
      // console.log('huvR4 id',huvR4.getId());

     this.loadAndRenderQuadView();
      let self = this;
      // r4 renderer
      this.r4 = {
        // domId: this.lhsElement4.id,
        domId: huvR4.getId(),
        domElement: null,
        renderer: null,
        color: 0x121212,
        sliceOrientation: 'axial',
        sliceColor: 0xFF1744,
        targetID: 4,
        camera: null,
        controls: null,
        scene: null,
        light: null,
        stackHelper: null,
        localizerHelper: null,
        localizerScene: null,
      };

      initRenderer3D(this.r4);

      this.r4.controls = new AxplaneControls(this.r4.camera, this.r4.domElement, this.positions);
      this.r4.scene.add(this.v1Mesh.clone());

      var helper0 = new THREE.CameraHelper(this.r4.camera)
      r0.scene.add(helper0); this.cameraHelperR4 = helper0;      
      r0.scene.add(new THREE.AxisHelper(100));
      r0.scene.remove(r0.light)     
      r0.scene.add(this.r4.controls.axplane);
      let centerLPS = this._stack.worldCenter(), axPosition = this.r4.controls.position;
      this.addSphereAtPoint(r0.scene,centerLPS)

      // Эксперименты с освещением
      // -------------------------
      // new THREE.AmbientLight(0xffffff, 1)    это просто равномерный дневной свет в тумане, то есть нет источника и направления
      // DirectionalLight - это фонарик с position и target       r0.light.target.position.set(pTarg.x, pTarg.y, pTarg.z); 
      // PointLight - это лампочка
      // SpotLight

      let pTarg = this.r4.controls.point(this.r4.controls.ptInd+2);
      this.r4.light = new THREE.PointLight(0xffffff, 1);
      let light = this.r4.light, scene = this.r4.scene;
      scene.add(light);

      this.r4.domElement.addEventListener('click', (e) => {
        console.log('click this.r4'); 
      });

      function animate() {
        requestAnimationFrame(animate);
        self.r4.controls.update();
        // let pTarg = self.r4.controls.point(self.r4.controls.ptInd+2);
        self.r4.light.position.copy(self.r4.camera.position);
        self.r4.renderer.render(self.r4.scene, self.r4.camera);
        // cameraInfo(huv);
      }

      console.log('start animation R4')
      animate();

  }

  
  makeR6() {
    let self = this;
    console.log('makeR6()') 
    this.makeR4();

    let r6 = UP3.enable(this.lhsElement3)
    r6.targetID = 6;    // это id который получит canvas
    UP3.initRenderer2D(this.lhsElement3);
    const R6cameraHelper = new THREE.CameraHelper(r6.camera);
    r0.scene.add(R6cameraHelper)

    // enabled2D отличаются не только камерой и controls, у них есть еще дополнительные поля sliceOrientation и sliceColor
    // а также stackHelper localizerHelper localizerScene
    // axial, coronal, sagittal
    r6.sliceOrientation = 'coronal';
    initHelpersStack(r6,this._stack);
    console.log('r6.camera.position after initHelpersStack',r6.camera.position)


    let axplane = this.r4.controls.axplane; //console.log('axplane',axplane)
    let axPosition = axplane.position.clone(), axNormal = axplane.normal.clone(); console.log('pos & nornal',axPosition,axNormal)
    let ijk = AMI.UtilsCore.worldToData(this._stack.lps2IJK, axPosition); console.log('ijk',ijk)

    // если менять slice.planeDirection, то картинка меняется, есть еще slice.planePosition
    // r6.stackHelper.slice.planeDirection = new THREE.Vector3(-0.5,0.5,0.5)
    r6.stackHelper.slice.planeDirection = axNormal;
    r6.stackHelper.slice.planePosition = ijk;
    console.log('001 r6.stackHelper.slice.geometry.vertices',r6.stackHelper.slice.geometry.vertices)

    function updateClipPlane(refObj) {
      const stackHelper = refObj.stackHelper;
      const camera = refObj.camera;
      let vertices = stackHelper.slice.geometry.vertices;
      let p1 = new THREE.Vector3(vertices[0].x, vertices[0].y, vertices[0].z)
        .applyMatrix4(stackHelper._stack.ijk2LPS);
      let p2 = new THREE.Vector3(vertices[1].x, vertices[1].y, vertices[1].z)
        .applyMatrix4(stackHelper._stack.ijk2LPS);
      let p3 = new THREE.Vector3(vertices[2].x, vertices[2].y, vertices[2].z)
        .applyMatrix4(stackHelper._stack.ijk2LPS);
      let p4 = new THREE.Vector3(vertices[3].x, vertices[3].y, vertices[3].z)
        .applyMatrix4(stackHelper._stack.ijk2LPS);
      addSphereAtPoint(r0.scene,p1); addSphereAtPoint(r0.scene,p2); addSphereAtPoint(r0.scene,p3); addSphereAtPoint(r0.scene,p4);

      // console.log(' p1 p2 p3', s(p1),s(p2),s(p3))

      // clipPlane.setFromCoplanarPoints(p1, p2, p3);

      // let cameraDirection = new THREE.Vector3(1, 1, 1);
      // cameraDirection.applyQuaternion(camera.quaternion);

      // if (cameraDirection.dot(clipPlane.normal) > 0) {
      //   clipPlane.negate();
      // }
    }
    updateClipPlane(r6)
    console.log('r6.camera.position',r6.camera.position)
    addSphereAtPoint(r0.scene,r6.camera.position);
  

      

    // UP3.render(this.lhsElement3)
    let controls = r6.controls, renderer = r6.renderer, scene = r6.scene, camera = r6.camera ;
    var v4positions = this.positions ; //console.log('v4positions',v4positions)
    let ind = this.r4.controls.ptInd; //console.log('ind',ind);

      function render() {
        requestAnimationFrame(render);

        let axPosition1 = axplane.position, axNormal1 = axplane.normal; 
        if((!axPosition1.equals(axPosition) || !axNormal1.equals(axNormal))) {
          axPosition = axPosition1.clone(); axNormal = axNormal1.clone(); 
          r6.stackHelper.slice["planeDirection"] = axNormal;
          let ijkPos = AMI.UtilsCore.worldToData(r6.stackHelper.stack.lps2IJK, axPosition);
          r6.stackHelper.slice["planePosition"] =  ijkPos;
          // console.log('new pos & nornal',s(ijkPos),s(axNormal))
        }

        controls.update();
        renderer.render(scene, camera);
      }

      console.log(" render() R6");
      render();

    // console.log('self.r4.stackHelper.slice',self.r4.stackHelper.slice)
    // self.r4.stackHelper.slice.halfDimensions = new THREE.Vector3(100,50,224.5)
    // self.r5.stackHelper.slice.planeDirection = this.clipPlane.normal.clone(); //new THREE.Vector3(0.1,0.2,0.3)
    // self.r5.camera.zoom = 3; 
    // self.r5.camera.updateProjectionMatrix();
    // let scaleX = 200/583
    // self.r4.camera.scale.x = scaleX


    /*    
      // это код, который получает срез 23 точки на сосуде в начальном положении Axplane
        this.makeR4();
        let box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({color:0x00ff00})); 
        let axplane = this.r4.controls.axplane;
        // box.position.copy(axplane.position);
        // r0.scene.add(box)
        let slicePoints = axplane.slicePoints(this.v1Mesh);
        console.log('slicePoints1',slicePoints.geometry.vertices)
        r0.scene.add(slicePoints);
    */
  }

  makeLineSegment(p1,p2) {
    var positions = [];
    var colors = []; 
    colors.push(0,1,0.);
    colors.push(0.,1.,0.);

    positions.push( p1.x, p1.y, p1.z );
    positions.push( p2.x, p2.y, p2.z );
    var geometry = new THREE.BufferGeometry();
    var material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );

    geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
    geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    geometry.computeBoundingSphere();
    return new THREE.LineSegments( geometry, material );   
  }

  makeLineSegments(vertices) {
    let positions = [];
    for(var i=0; i<vertices.length; i++) {
      let v0 = vertices[i], v1 = vertices[(i+1) % vertices.length];
      positions.push(v0.x, v0.y, v0.z);
      positions.push(v1.x, v1.y, v1.z);
    }
    let geometry = new THREE.BufferGeometry();
    var material = new THREE.LineBasicMaterial( { color:0x00FF00 } );
    geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
    geometry.computeBoundingSphere();

    let lineSegments = new THREE.LineSegments( geometry, material );
    return lineSegments;
  }

  makePoints(vertices) {
    let positions = [];
    for(var i=0; i<vertices.length; i++) {
      let v0 = vertices[i];
      positions.push(v0.x, v0.y, v0.z);
    }
    let geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
    var pMaterial = new THREE.PointsMaterial( {
      'color': 0x00FF00,
      'size': 3,
      'blending': THREE.AdditiveBlending,
      // transparent: true,
      'sizeAttenuation': false
    } );
    let pointCloud = new THREE.Points( geometry, pMaterial );
    return pointCloud;
  }


  placeCameraInFrontOfSlace(rx, axplane) {
    // axial slice pos & dir pos {x: 256, y: 256, z: 56} dir {x: 0, y: 0, z: 1}
    let camera = rx.camera,  scene = rx.scene;
    let stackHelper = rx.stackHelper, stack = stackHelper._stack, slice = stackHelper.slice;
    let normal = axplane.normal;//new THREE.Vector3(1,1,1).normalize();

    let targetSlicePositionLPS = axplane.position, targetSlicePositionIJK = AMI.UtilsCore.worldToData(stack.lps2IJK, targetSlicePositionLPS);
    let ijkNormal = new THREE.Vector3(normal.x*stack._spacing.x, normal.y*stack._spacing.y, normal.z*stack._spacing.z); //console.log('ijkNormal',ijkNormal)
    slice['planeDirection'] = ijkNormal;
    slice['planePosition']  = targetSlicePositionIJK;

    // addSphereAtPoint(scene,targetSlicePositionLPS);
    // let p2 = targetSlicePositionLPS.clone(); p2.x += 20;
    // scene.add(this.makeLineSegment(targetSlicePositionLPS,p2))

    let pX = new THREE.Vector3().addVectors(targetSlicePositionLPS,normal.clone().multiplyScalar(100))
    slice.geometry.computeBoundingBox();
    camera.position.set(pX.x,pX.y,pX.z); camera.lookAt(targetSlicePositionLPS); camera.updateProjectionMatrix();

    let centerlinePos = axplane.position, vesselAxSliceGeometry = axplane.sliceGeometry(this.v1Mesh), plane = axplane.plane();

    if(rx.pointCloud) rx.scene.remove(rx.pointCloud)
    rx.pointCloud = this.makePoints(vesselAxSliceGeometry.vertices)
    rx.scene.add(rx.pointCloud)

   // camera.controls = new DummyControls();
    let box = {
      center: axplane.position,
      halfDimensions:
        new THREE.Vector3(10, 10, 10),
    };
    camera.box = box;
    this.fitBox(box,rx)
  }

  colorVesselFaces(mesh,faces) {
    // эта функция расчитана на THREE.BufferGeometry
    // console.log('colorVesselFaces',faces)
    // console.log('geometry',mesh.geometry)
    var colors = mesh.geometry.attributes.color;
    faces.forEach(face=> {
      colors.setXYZ( 3*face, 1, 0, 0 );
      colors.setXYZ( 3*face+1, 1, 0, 0 );
      colors.setXYZ( 3*face+2, 1, 0, 0 );
      // console.log('color face ',face)
    })
    
    colors['needsUpdate'] = true;
  }

  // это вариант раскраски граней THREE.Geometry указанным цветом
  //
  colorMeshFaces(mesh,faces,color) {
    
    faces.forEach( f => mesh.geometry.faces[ f ].color.set( color ))
    mesh.geometry['colorsNeedUpdate'] = true;
  }

  // возвращает массив граней в которые входят указанные вершины
  //
  vertexFaces(mesh, vertices) {
    if(!(mesh.geometry instanceof THREE.Geometry)) 
      throw new Error('mesh geometry must be THREE.Geometry');
    const geometry = mesh.geometry;
    let faces = [];
    // console.log('geometry',geometry)

    function addNoDup(arr,val) {
      let dup = false;
      for(var i=0; i<arr.length; i++)
          if(arr[i] == val) {dup=true; break;}
      if(!dup) arr.push(val);
    }    

    vertices.forEach( v => {
      
      for(var i=0; i<mesh.geometry.faces.length; i++) {
        const f=mesh.geometry.faces[i];
        // console.log('f',f)
        if(f.a == v || f.b == v || f.c == v)
          // addNoDup(faces,i);
          faces.push(i);
      }
    });

    return faces;
  }

  markSliceVertices(rx) {
    let stackHelper = rx.stackHelper, vertices = stackHelper.slice.geometry.vertices, scene = rx.scene;
      let p1 = new THREE.Vector3(vertices[0].x, vertices[0].y, vertices[0].z).applyMatrix4(stackHelper._stack.ijk2LPS);      
      let p2 = new THREE.Vector3(vertices[1].x, vertices[1].y, vertices[1].z).applyMatrix4(stackHelper._stack.ijk2LPS);      
      let p3 = new THREE.Vector3(vertices[2].x, vertices[2].y, vertices[2].z).applyMatrix4(stackHelper._stack.ijk2LPS);      
      let p4 = new THREE.Vector3(vertices[3].x, vertices[3].y, vertices[3].z).applyMatrix4(stackHelper._stack.ijk2LPS);      
      addSphereAtPoint(scene,p1); addSphereAtPoint(scene,p2); addSphereAtPoint(scene,p3); addSphereAtPoint(scene,p4);    
  }

  fitBox(box,rx) {
    let stackHelper = rx.stackHelper, stack = stackHelper._stack, slice = stackHelper.slice, camera = rx.camera;
    let dimsX = box.halfDimensions.x * 2, dimsY = box.halfDimensions.y;
    let zoom = Math.min(camera['_canvas'].width/dimsX,camera['_canvas'].height/dimsY);
    // console.log('camera canvas w h right up box zoom',camera._canvas, camera._up, camera._right, camera.box,camera.zoom)
    // console.log('new zoom = ',zoom)
    
    let normal = slice['planeDirection'].clone();
    normal.x /= stack._spacing.x; normal.y /= stack._spacing.y; normal.z /= stack._spacing.z;
    // новое положение камеры над срезом 100?
    let camTargetPosition = new THREE.Vector3().addVectors(box.center,normal.clone().multiplyScalar(10))
    // console.log('camera position & target position',camera.position, camTargetPosition)
    camera.position.set(camTargetPosition.x,camTargetPosition.y,camTargetPosition.z);
    camera.lookAt(box.center.x, box.center.y, box.center.z);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }

  makeR7() {
    console.log('makeR7()')
    this.makeAortaAndVesselsMesh();
    // this.loadAndRenderQuadView();


    let huvR7 = new HUV({left:100, top:100, width:600, height:600, opacity:1}), r7id = huvR7.getId(), r7 = UP3.enable(r7id); 
    UP3.initRenderer3D(r7id)
    let stack = this._stack, camera = r7.camera, scene = r7.scene;   
    scene.add(this.vessel4.clone());

    camera.position.set(500,500,-500)
    let centerLPS = stack.worldCenter(), worldbb = stack.worldBoundingBox(); 
    let lpsDims = new THREE.Vector3( worldbb[1] - worldbb[0], worldbb[3] - worldbb[2], worldbb[5] - worldbb[4]);

    camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
    camera.updateProjectionMatrix();
    r7.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);

    r7.boxHelper = new AMI.BoundingBoxHelper(stack);
    //r7.scene.add(r7.boxHelper);

    let huvR7orto = new HUV({left:750, top:100, width:300, height:300, opacity:1}), ortor7id = huvR7orto.getId(), r7orto = UP3.enable(ortor7id); 
    UP3.initRenderer2D(ortor7id)
    r7orto.camera.controls = new DummyControls();   // не надо в 2D никаких контролов


    let ortoHelper = new THREE.CameraHelper(r7orto.camera)
    scene.add(ortoHelper)

    r7orto.sliceOrientation = 'axial';
    initHelpersStack(r7orto,stack)

    // let target = centerSliceWorld.clone(); target.x += 50;
    // r7orto.camera.lookAt(target); r7orto.camera.updateProjectionMatrix();
    // console.log('camera pos target dir',s(r7orto.camera.position),s(target),s(r7orto.camera.getWorldDirection(new THREE.Vector3())))
    let sliceCenterIJK = r7orto.stackHelper.slice['planePosition'], sliceCenterLPS = sliceCenterIJK.clone().applyMatrix4(stack.ijk2LPS)
    let sliceCenterLPS1 = sliceCenterLPS.clone(); sliceCenterLPS1.x +=20;
    // console.log('sliceCenterIJK sliceCenterLPS sliceCenterLPS1',sliceCenterIJK,sliceCenterLPS,sliceCenterLPS1)
    // let axplane = new Axplane(); axplane.setPositionAndNormal(sliceCenterLPS1, new THREE.Vector3(0,0,1).normalize());    
    let fakeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000), fakeElement = document.getElementById('r0');
    let axControl = new AxplaneControls(fakeCamera, fakeElement, this.positions);
    let axplane = axControl.axplane; scene.add(axplane)
    this.placeCameraInFrontOfSlace(r7orto, axplane)

    ortoHelper.update()
    scene.add(r7orto.scene)

    // UP3.render(r7id)
    // UP3.render(ortor7id)
    {
      const renderObj = r7
      const controls = renderObj.controls, renderer = renderObj.renderer, scene = renderObj.scene, camera = renderObj.camera;

      function render() {
        requestAnimationFrame(render);
        controls.update();
        renderer.render(scene, camera);
        r7orto.renderer.render(r7orto.scene, r7orto.camera);
      }
      console.log("local render()");
      render();
    }
  }

  // Маркировка стеноза: методы startStenosisMarkup, endStenosisMarkup, prepareStenosisResult
  //  startAxplane - начальное положение секущей плоскости
  startStenosisMarkup(axplane) {
    const vesselMesh = this.v1Mesh;   // надо бы брать из окружения
    const stack = this._stack;

    // маркировка стеноза явно использует vertices в геомертии
    if (!(vesselMesh.geometry instanceof THREE.Geometry)) {
      throw new Error('vessel must have THREE.Geometry');
    }

    this._stenosis.id = 1;
    this._stenosis.vesselInd = this._selectedVessel;
    this._stenosis.vesselMesh = vesselMesh;
    this._stenosis.start.pos.copy(axplane.position);
    this._stenosis.start.normal.copy(axplane.normal);
    // пусть будет так
    this._stenosis.end.pos.copy(axplane.position);
    this._stenosis.end.normal.copy(axplane.normal);
    let faces = this._stenosis.faces;

    let newFaces = axplane.sliceGeometry(vesselMesh).faces;
    console.log('startStenosisMarkup(): добавляем '+newFaces.length+' граней (без дубликатов)')

    function addNoDup(arr,val) {
      let dup = false;
      for(var i=0; i<arr.length; i++)
          if(arr[i] == val) {dup=true; break;}
      if(!dup) arr.push(val);
    }
    
    newFaces.forEach( val => addNoDup(faces, val) );
    console.log('_stenosis faces содержит '+faces.length+' элементов') 

    // вот большой вопрос - является ли отрисовка стеноза обязанностью *StenosisMarkup функций 
    // console.log('vesselMesh',vesselMesh)
    this.colorMeshFaces(vesselMesh, faces, this._stenosis.color)

    let posIJK = AMI.UtilsCore.worldToData(stack.lps2IJK, axplane.position);
    console.log('начальная отметка стеноза:',s(axplane.position),posIJK); 

    // this.updateStenosisMarkup(axplane);
  }

  //
  // Функция updateStenosisMarkup вызывается при движении секущей плоскости. Пространство от началоной плоскости до текущей
  // является пространством стеноза. Будем устанавливать нормаль начальной секущей плоскости в сторону конечной плоскости. 
  // Тогда положительным полупространством будем называть все точки вне плоскости, которые лежат в той части, что и конец нормали.
  // Для конечной секущей плоскости установим нормаль в сторону начальной плоскости. Тогда искомые вершины граней находятся
  // положительных полупространствах обеих плоскостей, то есть между ними. 
  // как определять положительное полупространство см. https://mathworld.wolfram.com/HessianNormalForm.html
  // 
  // rxx 
  updateStenosisMarkup(axplane) {
    if(this._stenosis.id <= 0) return;
    const p0 = this._stenosis.start.pos, n0 = this._stenosis.start.normal, 
      plane0 = new THREE.Plane().setFromNormalAndCoplanarPoint(n0,p0);
    const p1 = axplane.position, n1 = axplane.normal, plane1 = axplane.plane().clone();
    if(p0.equals(p1)) return;
    const D = plane1.distanceToPoint(p0);
    if(D < 0 ) plane1.negate();
    // if(D < 0) console.log('start plane behind'); else console.log('start plane ahead');

  
    // const plane = axplane.plane();
    const mesh = this._stenosis.vesselMesh;
    const t0 = performance.now();
    
    let vertices = [];    // вершины в положительном полупространстве

    mesh.updateMatrixWorld();
    let a = new THREE.Vector3();

    mesh.geometry.vertices.forEach( (v,ind) => {
      a = mesh.localToWorld(v.clone());
      // plane.normal.dot(a) + plane.constant > 0
      if(plane0.distanceToPoint(a) > 0 && plane1.distanceToPoint(a) > 0) vertices.push(ind);
    });
      
    console.log('updateStenosisMarkup: '+vertices.length+' вершин из '+this._stenosis.vesselMesh.geometry.vertices.length)

    let faces = this.vertexFaces(mesh,vertices);
    console.log('граней '+ faces.length + ' из '+ mesh.geometry.faces.length)
    this.colorMeshFaces(mesh, faces, this._stenosis.color)

    console.log('time elapsed', performance.now()-t0)  
  }

  endStenosisMarkup(axplane) {
    this._stenosis.end.pos.copy(axplane.position);
    this._stenosis.end.normal.copy(axplane.normal);
    let posIJK = AMI.UtilsCore.worldToData(this._stack.lps2IJK, axplane.position);
    console.log('конечная отметка стеноза:',s(axplane.position),posIJK); 
}


  // Экран в экране и маркировка стеноза
  //
  makeR8() {
    console.log('makeR8() hide')
    let IJK2LPS = this._stack.ijk2LPS;
    let vesselMaterial = new THREE.MeshLambertMaterial( { color: 0xd28e0c, side: THREE.DoubleSide, transparent: true, opacity: 0.5});
    let aortaMeterial = new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide });
    // this.dialog.dialog.dispose();   // почему-то не работает
    // toggle_1or4_windows(r0);
    $("r0").style.display="none";
    $("r1").style.display="none";
    $("r2").style.display="none";
    $("r3").style.display="none";

    let visRef = $("r0").parentNode, visArea; 
    if(UP3.isEnabled(visRef)) 
      visArea = UP3.getEnabledElement(visRef,true);
    else {
      visArea = UP3.enable(visRef);
      UP3.initRenderer3D(visRef); 
    }
    
    let scene = visArea.scene, camera = visArea.camera, stack = this._stack;
    // addSphereAtPoint(scene, new THREE. Vector3(0,0,0))


    this.makeAortaAndVesselsMesh();
    let centerLPS = this._stack.worldCenter();
    let camPos = new THREE.Vector3().addVectors(centerLPS, new THREE.Vector3(150,150,150))
    camera.position.set(camPos.x, camPos.y, camPos.z)
    camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
    console.log('centerLPS=',centerLPS)
    camera.updateProjectionMatrix();
    visArea.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);

    // сгладим аорту и сосуды
    // let modifier = new SubdivisionModifier(1), v1sGeom = modifier.modify(this.v1Mesh.geometry);
    // console.log('compare v1 geom',this.v1Mesh.geometry)
    // console.log('v1 smmoth geom',v1sGeom)
    
    // let v1sMat = vesselMaterial.clone();
    // let v1sMesh = new THREE.Mesh(v1sGeom,v1sMat)
    // v1sMesh.applyMatrix(IJK2LPS)
    // this.v1Mesh = this.smoothMesh(this.v1Mesh,1); 
    scene.add(this.aortaMesh); scene.add( this.v1Mesh); scene.add(this.vessel4);
    camera.zoom = 3;

    let huvR7orto = new HUV({left:750, top:100, width:300, height:300, opacity:1}), ortor7id = huvR7orto.getId(), r7orto = UP3.enable(ortor7id); 
    this.r7orto = r7orto;
    UP3.initRenderer2D(ortor7id)
    r7orto.camera.controls = new DummyControls();   // не надо в 2D никаких контролов
    r7orto.sliceOrientation = 'axial';
    initHelpersStack(r7orto,stack)
    // UP3.render(ortor7id);
    huvR7orto.dispose()

    // ставим Axplane на vessel4. AxplaneControls управляет камерой внутри сосуда, но это сейчас не нужно
    // this.positions - это centerline vessel4

    let fakeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000), fakeElement = null;
    let axControl = new AxplaneControls(fakeCamera, fakeElement, this.positions);
    this.axControl = axControl;
    let axplane = axControl.axplane; scene.add(axplane)
    document.addEventListener('keydown', e => this.onKeyDown(e), false);
    // scene.add(r7orto.scene)

    this.placeCameraInFrontOfSlace(r7orto, axplane)
    // this.startStenosisMarkup(axplane);

    let plane0 = axplane.plane();   // пусть это будет начальная отметка стеноза
    let posIJK = AMI.UtilsCore.worldToData(stack.lps2IJK, axplane.position);
    // console.log('Начальная отметка стеноза plane0', plane0,axplane.position,posIJK); 


    let asize = visArea.renderer.getSize(new THREE.Vector2()), w=asize.width,h=asize.height;
    
    // UP3.render(visRef)
    const renderObj = visArea
    const controls = renderObj.controls, renderer = renderObj.renderer//, scene = renderObj.scene, camera = renderObj.camera;

    // движение axplane обрабатывается здесь

    axControl.addEventListener('change', e => {  // обновить сцену r7orto
      console.log('axControl change event',e)
      this.placeCameraInFrontOfSlace(r7orto, axplane);  // новый slice
      this.updateStenosisMarkup(axplane);
    })

    function render() {
      requestAnimationFrame(render);
      controls.update();
      renderer.setViewport( 0, 0, w, h);
      renderer.render(scene, camera);

      const left=w*0.7, bottom=h*0.7, width=w*0.3, height=h*0.3
      renderer.setViewport( left, bottom, width, height );
      renderer.setScissor( left, bottom, width, height );
      renderer.setScissorTest( true );
      // renderer.setClearColor( view.background );

      // camera.aspect = width / height;
      // camera.updateProjectionMatrix();

      // renderer.render( scene, camera );
      renderer.render( r7orto.scene, r7orto.camera );
      
      renderer.setScissorTest( false );

    }

    render();

  }

  onKeyDown(e) {
    const axplane = this.axControl.axplane;
    // console.log('Dialog12::onKeyDown()');
    // console.log('AxplaneControls::onKeyDown() e.keyCode, e.code, e.ctrlKey, e.shiftKey=',e.keyCode, e.code, e.ctrlKey, e.shiftKey)
    if(e.code == 'KeyS') {
      // console.log('start stenosis markup')
      this.startStenosisMarkup(axplane);
    }
    else if(e.code == 'KeyF') {
      this.endStenosisMarkup(axplane);
    } 
    else if(e.code == 'ArrowRight') { 
      this.axControl.next();
      this.placeCameraInFrontOfSlace(this.r7orto, axplane);
      if(this._stenosis.id > 0) 
        this.updateStenosisMarkup(axplane);
    } 
    else if(e.code == 'ArrowLeft') {  
      this.axControl.prev();
      this.placeCameraInFrontOfSlace(this.r7orto, axplane);
    }

  }

  // это набросок как использовать SubdivisionModifier (алгоритм Катмулла-Кларка) для сглаживания 4-го сосуда
  //
  makeR9() {
    let IJK2LPS = this._stack.ijk2LPS;
    $("r0").style.display="none";
    $("r1").style.display="none";
    $("r2").style.display="none";
    $("r3").style.display="none";

    let visRef = $("r0").parentNode, visArea = UP3.enable(visRef);
    UP3.initRenderer3D(visRef); 
    let scene = visArea.scene, camera = visArea.camera, stack = this._stack;
    // addSphereAtPoint(scene, new THREE. Vector3(0,0,0))


    this.makeAortaAndVesselsMesh();
    let modifier = new SubdivisionModifier(2)
    let smooth = modifier.modify(this.v1Mesh.geometry);
    smooth.computeBoundingBox();
    console.log('bbox',smooth.boundingBox)

    let mat = new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide })
    let mesh = new THREE.Mesh(smooth,mat)
    mesh.applyMatrix(IJK2LPS)

    let centerLPS = this._stack.worldCenter();
    let camPos = new THREE.Vector3().addVectors(centerLPS, new THREE.Vector3(150,150,150))
    camera.position.set(camPos.x, camPos.y, camPos.z)
    camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
    console.log('centerLPS',centerLPS)
    camera.updateProjectionMatrix();
    visArea.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);
    scene.add(mesh)
    // scene.add(this.aortaMesh); //scene.add(this.v1Mesh); scene.add(this.vessel4);
    // console.log('aortaMesh geometry',this.aortaMesh.geometry);
    camera.zoom = 3;
    UP3.render(visRef)

    // visRef.addEventListener('click', (e) => {
    //   console.log('click visref'); 
    //   let modifier = new SubdivisionModifier(1)
    //   console.log('modifier',modifier)
    //   let smooth = modifier.modify(this.aortaMesh.geometry);
    //   console.log('smooth',smooth)
    //   let mat = new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide })
    //   let mesh = new THREE.Mesh(smooth,mat)
    //   scene.remove(this.aortaMesh)
    //   scene.add(mesh)
    // });
   
  }

  smoothMesh(mesh, subdivisions) {
    let modifier = new SubdivisionModifier(subdivisions);
    let smoothGeom = modifier.modify(mesh.geometry);    
    let smoothMat = mesh['material'].clone();
    let smoothMesh = new THREE.Mesh(smoothGeom,smoothMat)
    smoothMesh.applyMatrix(this._stack.ijk2LPS);
    return  smoothMesh;
  }

  addSphereAtPoint(scene, point) {
    console.log('addSphereAtPoint');
    var sphereGeometry = new THREE.SphereGeometry( 5, 32, 16 );
    var faceColorMaterial = new THREE.MeshBasicMaterial({color:0xff0000});
    var sphere = new THREE.Mesh( sphereGeometry, faceColorMaterial );
    sphere.position.set(point.x, point.y, point.z);
    scene.add(sphere);
    return sphere;
  }

}


var tab1HTML =
`<div>Карта <select><option>C1</option><option>RB2</option></select><br>
<input type="checkbox"><label>Применять карту</label></div>`
var tab2HTML = 
`<div style="display: flex; height:100%;">
  <div style="width:30%; height:99%; background:#CCC;border: 1px solid black;">&nbsp</div>
  <div style="width:70%; background:#ddd;  margin:0px 0px 0px 5px;">
    <fieldset><legend>Details</legend>
        Stenosis:   <input type="number" value="0" style="width: 6em;" disabled/> % &nbsp;&nbsp;&nbsp;&nbsp;Calculated:
    </fieldset>
    <button>Capture stenosis</button><button>Delete vein</button><br>
    <button disabled>Remove stenosis</button><br>
    <button>Clear list</button> <button>Start Calculation</button>
  </div>
</div>`         
/**
 * Dialog-12 Tab FFR Marks.
 *  Element         Function                Class-name, modal-dialog = default
 * ----------------------------------------------------------------------------
 * - div                                     goog-tab-content 600x160
 *     - div                                 display:flex 160x124 высота определяется контентом
 */    
 
/*
    

    <option>Left vessel: 2</option>
    <option>Left vessel: 3</option>
    <option>Right vessel: 1</option>
    <option>Right vessel: 2</option>
    <option>Right vessel: 3</option>

       function onScroll(event) {
          console.log('onScroll()')
          const id = event.target.domElement.id;
          let stackHelper = self.r4.stackHelper;
          switch (id) {
            case 'r1':
              stackHelper = r1.stackHelper;
              break;
            case 'r2':
              stackHelper = r2.stackHelper;
              break;
            case 'r3':
              stackHelper = r3.stackHelper;
              break;
          }

          if (event.delta > 0) {
            if (stackHelper.index >= stackHelper.orientationMaxIndex - 1) {
              return false;
            }
            stackHelper.index += 1;
          } else {
            if (stackHelper.index <= 0) {
              return false;
            }
            stackHelper.index -= 1;
          }

          // onGreenChanged();
          // updateLocalizer(r3, [r1.localizerHelper, r2.localizerHelper]);
          // updateClipPlane(r3, clipPlane3);

          // onRedChanged();
          // onYellowChanged();
        }

        // event listeners
        console.log('setting onScroll listener')
        this.r4.controls.setStateExtended(STATE.ROTATE);
        this.r4.controls.addEventListener('OnScroll', onScroll);


*/