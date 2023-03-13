/* globals Stats, dat*/
/*
import CamerasOrthographic from 'base/cameras/cameras.orthographic';
import ControlsOrthographic from 'base/controls/controls.trackballortho';
import ControlsTrackball from 'base/controls/controls.trackball';
import CoreUtils from 'base/core/core.utils';
import HelpersBoundingBox from 'base/helpers/helpers.boundingbox';
import HelpersContour from 'base/helpers/helpers.contour';
import HelpersLocalizer from 'base/helpers/helpers.localizer';
import HelpersStack from 'base/helpers/helpers.stack';
import LoadersVolume from 'base/loaders/loaders.volume';
*/
/*
Общая структура ami_quadview.js:
  Глобальные данные: globalContext, r0,r1,r2,r2, dataInfo, data, sceneClip,clipPlane1[123]
  class UITrackballOrthoContol
  function updateWLdicomInfo(rx)
  function getOffsetRect(elem)
  function getAreaByEvent(event)
  function initRenderer3D(renderObj)
  function initRenderer2D(rendererObj)
  function initHelpersStack(rendererObj, stack)
  function initHelpersLocalizer(rendererObj, stack, referencePlane, localizers)
  function initHelpers(..)
  ** Update Layer Mix
  function windowResize2D(rendererObj)
  function onWindowResize()
  function toggle_1or4_windows() [857]	-- переключение между 1 и 4 экранами, вызывается из onDoubleClick()
  function reloadAorta()
  function loadAortha(object)
  function render()
  function init()
  function initAMI()
  function loadPatientData(..) [1314]
    loader.load(files).then({
     ...
    function onDoubleClick(event) 	--устанавливает 3D курсор
    function onKeyDown(event)
     r0.domElement.addEventListener('dblclick', onDoubleClick);
     r1.domElement.addEventListener('dblclick', onDoubleClick);
     r2.domElement.addEventListener('dblclick', onDoubleClick);
     r3.domElement.addEventListener('dblclick', onDoubleClick);
    function onClick(event)		-- Cntrl-click установить точку комиссуры; Shift-click снять точку комиссуры
     r0.domElement.addEventListener('click', onClick);	--для установки/снятия точек комиссуры

    -- эти три функции внизу обрабатывают события мыши в r0
    -- они отдают управление при включении режима V5.Viewer.getInteractive()
    -- а сами реализуют Cntrl-Down - addComissure; Shift-Down deleteComissure Drag - moveComissure
    function onMousedown()
    function onMousemove()
    function onMouseup()

    function onScroll(event)
     r1.controls.addEventListener('OnScroll', onScroll);
     r2.controls.addEventListener('OnScroll', onScroll);
     r3.controls.addEventListener('OnScroll', onScroll);
     window.addEventListener('resize', onWindowResize, false);
     data.foreach {
       loadAortha()
     }
    }   // конец loadPatientData
    .catch(function(error){..})
*/
'use strict';
// standard global variables
let stats;
let ready = false;

let redContourHelper = null;
let redTextureTarget = null;
let redContourScene = null;

// глобальные переменные
var globalContext = {
  aortha: undefined,        // после загрузки - Mesh аорты
  // точки комиссуры добавляются как THREE.SphereGeometry, то есть
  // sphere.position является координатами точки комиссуры
  commissurePoints: [],     // сетки добавленных точек комиссур
  altPoints: [],            // дополнительные точки комиссур
  win4: true,               // признак того, что на экране 4 окна
  infoVisible:false,        // видимость div info
  planesVisible:true,       // видимость плоскостей в 3D
};
// DICOM meta information
var dmi = {};

// 3d renderer
const r0 = {
  domId: 'r0',
  domElement: null,
  renderer: null,
  color: 0x212121,
  targetID: 0,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  dicomInfo: null,          // ссылка на объект класса DicomInfo
  boxHelper:null,           // надо для dispose
  stack:null,
};

// 2d axial renderer
const r1 = {
  domId: 'r1',
  domElement: null,
  renderer: null,
  color: 0x121212,
  sliceOrientation: 'axial',
  sliceColor: 0xFF1744,
  targetID: 1,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  stackHelper: null,
  localizerHelper: null,
  localizerScene: null,
  dicomInfo: null,          // ссылка на объект класса DicomInfo
};

// 2d sagittal renderer
const r2 = {
  domId: 'r2',
  domElement: null,
  renderer: null,
  color: 0x121212,
  sliceOrientation: 'sagittal',
  sliceColor: 0xFFEA00,
  targetID: 2,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  stackHelper: null,
  localizerHelper: null,
  localizerScene: null,
  dicomInfo: null,          // ссылка на объект класса DicomInfo
};


// 2d coronal renderer
const r3 = {
  domId: 'r3',
  domElement: null,
  renderer: null,
  color: 0x121212,
  sliceOrientation: 'coronal',
  sliceColor: 0x76FF03,
  targetID: 3,
  camera: null,
  controls: null,
  scene: null,
  light: null,
  stackHelper: null,
  localizerHelper: null,
  localizerScene: null,
  dicomInfo: null,          // ссылка на объект класса DicomInfo
};

// data to be loaded
let dataInfo = [
    ['adi1', {
        location: '',
        label: 'Left',
        loaded: false,
        material: null,
        materialFront: null,
        materialBack: null,
        mesh: null,
        meshFront: null,
        meshBack: null,
         color: 0xe91e63,
         //color: 0x00ff00,
        opacity: 0.8,
    }],
];

let data = new Map(dataInfo);

// extra variables to show mesh plane intersections in 2D renderers
let sceneClip = new THREE.Scene();
let clipPlane1 = new THREE.Plane(new THREE.Vector3(0, 0, 0), 0);
let clipPlane2 = new THREE.Plane(new THREE.Vector3(0, 0, 0), 0);
let clipPlane3 = new THREE.Plane(new THREE.Vector3(0, 0, 0), 0);

function toString(v) {
  return "[ " + v.x + ", " + v.y + ", " + v.z + " ]";
}


function hit(event,targets) {
    //console.log('hit() targets=',targets);
    var scene = r0.scene;
    var camera = r0.camera;

    const canvas = event.target.parentElement;
    const raycaster = new THREE.Raycaster();
    var canvasOffset = getOffsetRect(canvas);
    const mouse = {
      x: ((event.clientX - canvasOffset.left) / canvas.clientWidth) * 2 - 1,
      y: - ((event.clientY - canvasOffset.top) / canvas.clientHeight) * 2 + 1,
    };

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(targets, true);
    return intersects;
}

//=============UITrackballOrthoContol
// STATE - это копия из AMI.TrackballControl; она определена в UITrackballControl
// как то вот не нашел я способа в JS привязать этот enum к классу
//
//const STATE = {NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM: 4, TOUCH_PAN: 5, CUSTOM: 99};
//
// Наследование класса V5TrackballControl позволило довольно изящно решить одну проблему, которую изначально
// я не знал как решить. С одной стороны не хотелось сильно трогать THREE TrackballControl и его модификации
// AMI.TrackballControl  и AMI.TrackballOrthoControl. Они замечательно реализуют режимы ZOOM и PAN, управляя
// THREE.Camera, но режим Window/Level базовый класс реализовать совершенно не может, так как в нем надо
// управлять AMI.StackHelper.Slice, про который базовый класс знать ничего не знает. Наследование позволило
// вынести в подкласс функцию custom(), которая реализована прямо здесь, то есть в прямой видимости stackHelper
// Тем самым базовый класс берет на себя PAN и ZOOM, а подкласс - Window/Level (и при необходимости все
// другое, что требует знаение AMI). Свою модификацию базового класса все-таки пришлось сделать, так как
// она является гибридом AMI.TrackballControl и AMI.TrackballOrthoControl.
//
// STATE_EXT - это расширение STATE класса V5TrackballControl
// WINLEVEL   [r123]   =>     NONE
// CURSOR3D   [r0123]? =>     NONE    ( событие 'onclick' обрабатывается в UITrackballOrthoContol)
// ANN_LINE   [r123]   =>     NONE
const STATE_EXT = {WINLEVEL:50, CURSOR3D:51, ANN_LINE:52};
let cnt = 0;
class UITrackballOrthoContol extends V5TrackballControl {

    //_stateExt;        --а GCC ругается на такие определения полей
    //#stateExt;

    // это метод класса

    constructor(object, domElement) {
        super(object, domElement);
        cnt++;
        let three = window.THREE;
        let _this = this;

        //this.panSpeed = 2.0;
        //this.#stateExt = 98;    // эксперименты

        this._stateExt = STATE.NONE;
        this.buttonDown = false;
        this._downStartEvent = null;
        this._downEndEvent = null;
        let _downStart = new three.Vector2();
        let _downEnd = new three.Vector2();


        let getMouseOnScreen = (function() {
          let vector = new three.Vector2();

          return function getMouseOnScreen(pageX, pageY) {
            vector.set(
              (pageX - _this.screen.left) / _this.screen.width,
              (pageY - _this.screen.top) / _this.screen.height
            );

            return vector;
          };
        }());

        this.onMousedown = function(event) {    //test
            //console.log('UITrackballOrthoContol::onMouseDown()');

            _this.buttonDown = true;
            _this._downStartEvent = event;
            _this._downEndEvent = event;

            // отметить точку старта для всех режимов
            _downStart.copy(getMouseOnScreen(event.pageX, event.pageY));
            //console.log('downStart=')+console.log(_downStart);
            _downEnd.copy(_downStart);

            // Аннотации/Расстояние
            //if(_this._stateExt==STATE_EXT.ANN_LINE) {
            //    startAnnotationLine(event);
            //}
        }

        this.onMouseup = function(event) {    //test
            //console.log('UITrackballOrthoContol::onMouseup()');
            _this.buttonDown = false;
        }

        // движение мыши отслеживаем всегда, так как она может находится над аннотациями
        // и тогда надо показать, что ее можно схватить. А как в r0 c точками комиссуры?
        //
        this.onMousemove = function(event) {    //test
            //console.log('UITrackballOrthoContol::onMousemove()'+_this._stateExt);
            //console.log(_this.domElement);  // работает
            //console.log(event);
            _this._downEndEvent = event;
            if(_this.buttonDown) {  // большинство состояний работает в режиме drag
                if(_this._stateExt==STATE_EXT.WINLEVEL) {
                    _downEnd.copy(getMouseOnScreen(event.pageX, event.pageY));
                    _this.custom(_downStart,_downEnd);
                }
            }
        }

        domElement.addEventListener('mousedown', this.onMousedown, false);
        domElement.addEventListener('mouseup', this.onMouseup, false);
        domElement.addEventListener('mousemove', this.onMousemove, false);

        // функция вызывается с координатами начальной точки в режиме Аннотации/Расстояние
        //
        function startAnnotationLine(event) {
            //console.log('UITrackballOrthoContol::startAnnotationLine()');
            /**
             * Оказывается event.{offsetX,offsetY} дает сразу относительные координаты
             * клика на target, что я пытался вычислить через event.{clientX,clientY}
             * и канторовскую процедуру вычисления topleft элемента
             * var topleft = getOffsetRect(event.target); что говорит о том, что
             * процедура кантора верная. Кстати с event.{offsetX,offsetY} совпадают
             * непонятные event.{layerX,layerY}, надо почитать
             * Вот здесь описано как правильно пересчитывать координаты клика по canvas в пискели
             * https://stackoverflow.com/questions/43853119/javascript-wrong-mouse-position-when-drawing-on-canvas
             */
            //console.log('event.target.id='+event.target.id);
            //console.log(event);
            console.log(event.target);
            var rect = event.currentTarget.getBoundingClientRect();
            var target = {x:event.offsetX * event.target.width/rect.width,
                          y:event.offsetY * event.target.height/rect.height};


            var canvas = event.target;
            var ctx = canvas.getContext('2d');
            if(ctx == null) {
                // если не можем получить 2D контекст, значит попали
                // не в canvas, такое иногда бывает, что target не canvas, а div
                // они в точности лежат друг поверх друга, но почему возвращается
                // так или иначе, я не знаю.
                console.log('getContext2D null');
                return;
            }
            // рисуем крестик в точке клика
            ctx.fillStyle = "#FF0000";
            ctx.strokeStyle = "#FF0000";
            ctx.lineWidth = 1;
            ctx.beginPath();

            // рисуем крестик в точке клика
            ctx.moveTo(target.x-10,target.y);
            ctx.lineTo(target.x+10,target.y);
            ctx.moveTo(target.x,target.y-10);
            ctx.lineTo(target.x,target.y+10);

            ctx.fillStyle = "rgba(0,255,0,0.1)";
            ctx.fillRect(0,0,100,100);
            ctx.fill();

            // рисуем референтный крестик в 50,50
            ctx.fillStyle = "#0000FF";
            ctx.moveTo(45,50);
            ctx.lineTo(55,50);
            ctx.moveTo(50,45);
            ctx.lineTo(50,55);
            ctx.stroke();
            ctx.closePath();


            let rx = getAreaByEvent(event);
            if(!rx) { console.log('не попали'); return;}
            var canvasOffset = getOffsetRect(event.target);
            const mouse = {
              x: ((event.clientX - canvasOffset.left) / canvas.clientWidth) * 2 - 1,
              y: - ((event.clientY - canvasOffset.top) / canvas.clientHeight) * 2 + 1,
            };

            let camera = rx.camera;
            let stackHelper = rx.stackHelper;
            let scene = rx.scene;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects(scene.children, true);
            console.log(intersects);
            if(intersects.length > 0) {
                console.log("Hit @ " + toString( intersects[0].point) );
                console.log(intersects[0].point.toString());
                let ijk =
                  AMI.UtilsCore.worldToData(stackHelper.stack.lps2IJK, intersects[0].point);
                console.log('IJK=');console.log(ijk);
                //console.log(intersects[0].object);
                if (intersects[0].object && intersects[0].object.objRef) {
                    const refObject = intersects[0].object.objRef;
                    console.log('refObject='); console.log(refObject);
                }
            }

        }

        // эта функция обрабатывает изменения окна/уровня в окнах r[123]
        // управляет r[123].stackHelper.slice и отображает W/L в верхнем правом углу
        //
        this.custom = function(start,end) {
            //console.log('start='); console.log(start);
            //console.log('end='); console.log(end);
            let mouseChange = new THREE.Vector2();
            mouseChange.copy(end).sub(start);
            // классы AMI.StackHelper
            // у r[123].stackHelper.slice  есть поля windowWidth и windowCenter
            // для которых определены getters и setters windowWidth=600 windowCenter=200
            // var stack = stackHelper.stack;
            // windowWidth: 1, stack.minMax[1] - stack.minMax[0] lesson01 [1,2012]
            // windowCenter: stack.minMax[0], stack.minMax[1]    lesson01 [0,2012]
            // фактический minMax -1024 3071, почему в lesson01 начало в 0 - непонятно
            // диапазон [-1024,3071] это у anon 123 кадр, а в lesson01 другой DICOM, но не суть
            let rx = this.findCtlInfoBlock(this.domElement);
            let ww = rx.stackHelper.stack.minMax[1] - rx.stackHelper.stack.minMax[0];
            let dw = Math.round(mouseChange.x * ww);
            let dc = Math.round(mouseChange.y * ww);
            let wval = rx.stackHelper.slice.windowWidth + dw;
            if(wval < 1) wval = 1;
            let cval = rx.stackHelper.slice.windowCenter + dc;
            rx.stackHelper.slice.windowWidth = wval;
            rx.stackHelper.slice.windowCenter = cval;
            updateWLdicomInfo(rx);
            _downStart.copy(_downEnd);
        }

        // эта функция занимается отрисовкой аннотаций в областях r123 на каждом цикле анимации
        // обработчики событий только готовят данные для этой функции, но сами рисованием не
        // занимаются
        //
        this.update = function() {
            //console.log('UITrackballOrthoContol::update()');
            this.updateAnnotations();

            this.update_base();
        }

        this.updateAnnotations = function() {
          return;

            var rx = this.findCtlInfoBlock(domElement);
            if(rx.targetID != 1) return;

            //console.log('rx='); console.log(rx);
            var canvas = document.getElementById(rx.domId+'-anno');;
            var ctx = canvas.getContext('2d');
            if(ctx == null) {
                //console.log('getContext2D null');
                return;
            }
            ctx.clearRect(0,0,canvas.width,canvas.height);
            // если в режиме резиновой нити Расстояние
            if(_this._stateExt==STATE_EXT.ANN_LINE) {
                if(_this.buttonDown) {
                    // рисуем резиновую нить от
                    var rect = canvas.getBoundingClientRect();
                    var p0 = {x:_this._downStartEvent.offsetX * _this._downStartEvent.target.width/rect.width,
                              y:_this._downStartEvent.offsetY * _this._downStartEvent.target.height/rect.height};
                    var p1 = {x:_this._downEndEvent.offsetX * _this._downEndEvent.target.width/rect.width,
                              y:_this._downEndEvent.offsetY * _this._downEndEvent.target.height/rect.height};
                    ctx.beginPath();
                    //ctx.fillStyle = "#FF0000";
                    ctx.strokeStyle = "#FF0000";
                    // рисуем резиновую нить
                    ctx.moveTo(p0.x,p0.y);
                    ctx.lineTo(p1.x,p1.y);
                    ctx.stroke();
                    ctx.closePath();
                }
            }
        }
    }


    isExtendedState(state) {
        // все, кроме WINLEVEL
        return(state === STATE_EXT.CURSOR3D || state === STATE_EXT.ANN_LINE);
    }

    // интересно, когда кто-то извне сделает такое присваивание
    // rendererObj.controls.staticMoving = true;
    // то это в мое поле staticMoving будет присваивание или в родительское

    setStateExtended(targetState) {
        //console.log('setStateExtended('+targetState+')');
        // у себя храним полное состояние STATE+EXTENDED
        this._stateExt = targetState;
        // отключаем базовый класс, если состояние EXTENDED
        if(this.isExtendedState(targetState))
            this.setState(STATE.NONE);
        else
        this.setState(targetState);
    }

    // найти управляющий блок r[123] по domElement
    findCtlInfoBlock(domElement) {
        if(r1.domElement == domElement) return r1;
        if(r2.domElement == domElement) return r2;
        if(r3.domElement == domElement) return r3;
        return null;
    }
}

//===================================
// Вспомогательные функции для UITrackballOrthoContol
//===================================
function updateWLdicomInfo(rx) {
    if(rx.dicomInfo === null) return;
    var l1 = 'W '+rx.stackHelper.slice.windowWidth+' / C '+rx.stackHelper.slice.windowCenter+' <br>';
    var l2 = 'Кадр: '+rx.stackHelper.index+' / '+rx.stackHelper.orientationMaxIndex;
    rx.stackHelper.slice.intensityAuto = false;
    rx.dicomInfo.setTextRight(l1+l2);
}

// как определить координаты левого верхнего угла произвольного элемента
// источник (статья Ильи Кантора): https://javascript.ru/ui/offset
//
function getOffsetRect(elem) {
  var box = elem.getBoundingClientRect();
  var body = document.body;
  var docElem = document.documentElement;
  var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
  var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;
  var clientTop = docElem.clientTop || body.clientTop || 0;
  var clientLeft = docElem.clientLeft || body.clientLeft || 0;
  var top  = box.top +  scrollTop - clientTop;
  var left = box.left + scrollLeft - clientLeft;
  return { top: Math.round(top), left: Math.round(left) };
}

// функция определяет в какую из областей r1234 попало событие клика
//
function getAreaByEvent(event) {
    if(!event.target.id) return null;
    let rx = null;
    switch (event.target.id) {
    case '0': rx = r0; break;   // ?
    case 'r1-anno': case 'r1': case '1': rx = r1; break;
    case 'r2-anno': case 'r2': case '2': rx = r2; break;
    case 'r3-anno': case 'r3': case '3': rx = r3; break;
    }
    return rx;
}

//===================================

function initRenderer3D(renderObj) {
  // renderer
  renderObj.domElement = document.getElementById(renderObj.domId);
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
  //renderObj.controls.zoomSpeed = 1.2;
  renderObj.controls.panSpeed = 0.8;
  renderObj.controls.staticMoving = true;
  renderObj.controls.dynamicDampingFactor = 0.3;

  // scene
  renderObj.scene = new THREE.Scene();

  // light
  renderObj.light = new THREE.DirectionalLight(0xffffff, 1);
  renderObj.light.position.copy(renderObj.camera.position);
  renderObj.scene.add(renderObj.light);

  var pointLight = new THREE.PointLight(0xffff00, 1.0);
  pointLight.position.copy(renderObj.camera.position);
  renderObj.scene.add(pointLight);
  var pointLightHelper = new THREE.PointLightHelper(pointLight, 50); // 50 is sphere size
  // renderObj.scene.add(pointLightHelper);


  // stats
  stats = new Stats();
  //renderObj.domElement.appendChild(stats.domElement);
}

function initRenderer2D(rendererObj) {
  // renderer
  rendererObj.domElement = document.getElementById(rendererObj.domId);
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
  // rendererObj.camera = new THREE.OrthographicCamera(
    rendererObj.domElement.clientWidth / -2,
    rendererObj.domElement.clientWidth / 2,
    rendererObj.domElement.clientHeight / 2,
    rendererObj.domElement.clientHeight / -2,
    1, 1000);

  // controls
  //rendererObj.controls = new AMI.TrackballOrthoControl(
  rendererObj.controls = new UITrackballOrthoContol(
    rendererObj.camera, rendererObj.domElement);
  rendererObj.controls.staticMoving = true;
  rendererObj.controls.noRotate = true;
  rendererObj.camera.controls = rendererObj.controls;

  // scene
  rendererObj.scene = new THREE.Scene();
}

function initHelpersStack(rendererObj, stack) {
    rendererObj.stackHelper = new AMI.StackHelper(stack);
    rendererObj.stackHelper.bbox.visible = false;
    rendererObj.stackHelper.borderColor = rendererObj.sliceColor;
    rendererObj.stackHelper.slice.canvasWidth =
      rendererObj.domElement.clientWidth;
    rendererObj.stackHelper.slice.canvasHeight =
      rendererObj.domElement.clientHeight;

    // set camera
    let worldbb = stack.worldBoundingBox();
    let lpsDims = new THREE.Vector3(
      (worldbb[1] - worldbb[0])/2,
      (worldbb[3] - worldbb[2])/2,
      (worldbb[5] - worldbb[4])/2
    );

    // box: {halfDimensions, center}
    let box = {
      center: stack.worldCenter().clone(),
      halfDimensions:
        new THREE.Vector3(lpsDims.x + 10, lpsDims.y + 10, lpsDims.z + 10),
    };

    // init and zoom
    let canvas = {
        width: rendererObj.domElement.clientWidth,
        height: rendererObj.domElement.clientHeight,
      };

    rendererObj.camera.directions =
      [stack.xCosine, stack.yCosine, stack.zCosine];
    rendererObj.camera.box = box;
    rendererObj.camera.canvas = canvas;
    rendererObj.camera.orientation = rendererObj.sliceOrientation;
    rendererObj.camera.update();
    rendererObj.camera.fitBox(2, 1);

    rendererObj.stackHelper.orientation = rendererObj.camera.stackOrientation;
    rendererObj.stackHelper.index =
      Math.floor(rendererObj.stackHelper.orientationMaxIndex/2);
    rendererObj.scene.add(rendererObj.stackHelper);
}

function initHelpersLocalizer(rendererObj, stack, referencePlane, localizers) {
    rendererObj.localizerHelper = new AMI.LocalizerHelper(
      stack, rendererObj.stackHelper.slice.geometry, referencePlane);

    for (let i = 0; i < localizers.length; i++) {
      rendererObj.localizerHelper['plane' + (i + 1)] = localizers[i].plane;
      rendererObj.localizerHelper['color' + (i + 1)] = localizers[i].color;
    }

    rendererObj.localizerHelper.canvasWidth =
      rendererObj.domElement.clientWidth;
    rendererObj.localizerHelper.canvasHeight =
      rendererObj.domElement.clientHeight;

    rendererObj.localizerScene = new THREE.Scene();
    rendererObj.localizerScene.add(rendererObj.localizerHelper);
}

function initHelpers(stack) {
    console.log('initHelpers()');

    // bouding box
    r0.boxHelper = new AMI.BoundingBoxHelper(stack);
    r0.scene.add(r0.boxHelper);

    // red slice
    initHelpersStack(r1, stack);
      //console.log('r1.stackHelper.orientationSpacing='+r1.stackHelper.orientationSpacing);
    r0.scene.add(r1.scene);

    redTextureTarget = new THREE.WebGLRenderTarget(
      r1.domElement.clientWidth,
      r1.domElement.clientHeight,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
      }
    );

    redContourHelper = new AMI.ContourHelper(stack, r1.stackHelper.slice.geometry);
    redContourHelper.canvasWidth = redTextureTarget.width;
    redContourHelper.canvasHeight = redTextureTarget.height;
    redContourHelper.textureToFilter = redTextureTarget.texture;
    redContourScene = new THREE.Scene();
    redContourScene.add(redContourHelper);

    // yellow slice
    initHelpersStack(r2, stack);
      //console.log('r2.stackHelper.orientationSpacing='+r2.stackHelper.orientationSpacing);
    r0.scene.add(r2.scene);

    // green slice
    initHelpersStack(r3, stack);
      //console.log('r3.stackHelper.orientationSpacing='+r3.stackHelper.orientationSpacing);
    r0.scene.add(r3.scene);

    // create new mesh with Localizer shaders
    let plane1 = r1.stackHelper.slice.cartesianEquation();
    let plane2 = r2.stackHelper.slice.cartesianEquation();
    let plane3 = r3.stackHelper.slice.cartesianEquation();

    // localizer red slice
    initHelpersLocalizer(r1, stack, plane1, [
      {plane: plane2,
       color: new THREE.Color(r2.stackHelper.borderColor),
      },
      {plane: plane3,
       color: new THREE.Color(r3.stackHelper.borderColor),
      },
    ]);

    // localizer yellow slice
    initHelpersLocalizer(r2, stack, plane2, [
      {plane: plane1,
       color: new THREE.Color(r1.stackHelper.borderColor),
      },
      {plane: plane3,
       color: new THREE.Color(r3.stackHelper.borderColor),
      },
    ]);

    // localizer green slice
    initHelpersLocalizer(r3, stack, plane3, [
      {plane: plane1,
       color: new THREE.Color(r1.stackHelper.borderColor),
      },
      {plane: plane2,
       color: new THREE.Color(r2.stackHelper.borderColor),
      },
    ]);

}

/**
 * Update Layer Mix
 */
function updateLocalizer(refObj, targetLocalizersHelpers) {
  let refHelper = refObj.stackHelper;
  let localizerHelper = refObj.localizerHelper;
  let plane = refHelper.slice.cartesianEquation();
  localizerHelper.referencePlane = plane;

  // bit of a hack... works fine for this application
  for (let i = 0; i < targetLocalizersHelpers.length; i++) {
    for (let j = 0; j < 3; j++) {
      let targetPlane = targetLocalizersHelpers[i]['plane' + (j + 1)];
      if (targetPlane &&
         plane.x.toFixed(6) === targetPlane.x.toFixed(6) &&
         plane.y.toFixed(6) === targetPlane.y.toFixed(6) &&
         plane.z.toFixed(6) === targetPlane.z.toFixed(6)) {
        targetLocalizersHelpers[i]['plane' + (j + 1)] = plane;
      }
    }
  }

  // update the geometry will create a new mesh
  localizerHelper.geometry = refHelper.slice.geometry;
}

function updateClipPlane(refObj, clipPlane) {
  const stackHelper = refObj.stackHelper;
  const camera = refObj.camera;
  let vertices = stackHelper.slice.geometry.vertices;
  let p1 = new THREE.Vector3(vertices[0].x, vertices[0].y, vertices[0].z)
    .applyMatrix4(stackHelper._stack.ijk2LPS);
  let p2 = new THREE.Vector3(vertices[1].x, vertices[1].y, vertices[1].z)
    .applyMatrix4(stackHelper._stack.ijk2LPS);
  let p3 = new THREE.Vector3(vertices[2].x, vertices[2].y, vertices[2].z)
    .applyMatrix4(stackHelper._stack.ijk2LPS);

  clipPlane.setFromCoplanarPoints(p1, p2, p3);

  let cameraDirection = new THREE.Vector3(1, 1, 1);
  cameraDirection.applyQuaternion(camera.quaternion);

  if (cameraDirection.dot(clipPlane.normal) > 0) {
    clipPlane.negate();
  }
}

function onYellowChanged() {
    updateLocalizer(r2, [r1.localizerHelper, r3.localizerHelper]);
    updateClipPlane(r2, clipPlane2);
    updateWLdicomInfo(r2);
}

function onRedChanged() {
    updateLocalizer(r1, [r2.localizerHelper, r3.localizerHelper]);
    updateClipPlane(r1, clipPlane1);

    if (redContourHelper) {
        redContourHelper.geometry = r1.stackHelper.slice.geometry;
    }
    updateWLdicomInfo(r1);
}

function onGreenChanged() {
    updateLocalizer(r3, [r1.localizerHelper, r2.localizerHelper]);
    updateClipPlane(r3, clipPlane3);
    updateWLdicomInfo(r3);
}

function $( id ) {
  if(id.substring(0,1) == '#')
      return document.querySelectorAll(id);
  else
      return document.getElementById( id );
}


function windowResize2D(rendererObj) {
    //console.log('windowResize2D rendererObj.domElement='); console.log(rendererObj.domElement);
  rendererObj.camera.canvas = {
    width: rendererObj.domElement.clientWidth,
    height: rendererObj.domElement.clientHeight,
  };
    // поскольку элементы r[0123] могут быть "схлопнуты" при переключении 4-в-1
    // их ширина и высота становится равной 0 и это вызывает ненужную диагностику
    // "Invalid dimension provided" при вызове функции fitBox()
    if(rendererObj.domElement.clientWidth != 0)
        rendererObj.camera.fitBox(2, 1);
  rendererObj.renderer.setSize(
    rendererObj.domElement.clientWidth,
    rendererObj.domElement.clientHeight);

  // update info to draw borders properly
  rendererObj.stackHelper.slice.canvasWidth =
    rendererObj.domElement.clientWidth;
  rendererObj.stackHelper.slice.canvasHeight =
    rendererObj.domElement.clientHeight;
  rendererObj.localizerHelper.canvasWidth =
    rendererObj.domElement.clientWidth;
  rendererObj.localizerHelper.canvasHeight =
    rendererObj.domElement.clientHeight;
}

function onWindowResize() {
  // update 3D
  r0.camera.aspect = r0.domElement.clientWidth / r0.domElement.clientHeight;
  r0.camera.updateProjectionMatrix();
  r0.renderer.setSize(
    r0.domElement.clientWidth, r0.domElement.clientHeight);

  // update 2d
  windowResize2D(r1);
  windowResize2D(r2);
  windowResize2D(r3);
}


// переключение между 1 и 4 экранами
//
function toggle_1or4_windows(div) {
    //console.log('toggle_1or4_windows()');
    if(globalContext.win4) {
        $("r0").style.display="none";
        $("r1").style.display="none";
        $("r2").style.display="none";
        $("r3").style.display="none";
        div.style.display="block";
        div.style.width="100%";
        div.style.height="100%";
        globalContext.win4 = false;
    }
    else {
        $("r0").style.display="block";
        $("r1").style.display="block";
        $("r2").style.display="block";
        $("r3").style.display="block";
        div.style.width="50%";
        div.style.height="50%";
        globalContext.win4 = true;
    }
    onWindowResize();
}
//////////////////////////////////////////////////////////

function reloadAorta(url) {
    data.forEach(function(object, key) {
          object.location = url;
          loadAortha(object);
    });
}

function loadAortha(object) {

    console.log('loadAortha('+object.location+')');
    let pDiv = document.getElementById("progressBar");

    function onprogressLoadAorta(e) {
        //console.log('onprogressLoadAorta()',e);
        pDiv.style.display="block";
        pDiv.style.top = "50%";
        pDiv.style.left = "15%";
        let msg0 = 'Загрузка аорты.. ';
        let percent = Math.floor(e.loaded / e.total * 100);
        let msg = msg0+percent+'%';
        pDiv.innerHTML = '<span style="font-size: 400%">'+msg+'</span>';
        if(e.loaded == e.total)
            pDiv.innerHTML = '';
    }

    function onerrorLoadAorta(e) {
        console.log('onerrorLoadAorta()',e);
        alert('loadAortha() exception occured');
    }

    // если URL аорты задан, то грузим ее
    // а для тех пациентов, у которых аорта еще не обработана, грузим пустую геометрию
    //
    if(object.location != undefined && object.location != "") {
        var loader1 = new THREE.STLLoader();
        loader1.load(object.location,
                     processAortaGeometry,
                     onprogressLoadAorta,
                     onerrorLoadAorta);
    }
    else {
        console.log('У пациента еще не обработана аорта. Грузим пустую геометрию');
        processAortaGeometry(new THREE.Geometry());

        // console.log('Специальная ветка для тестирования срезов');
        // var sphereGeometry = new THREE.SphereGeometry( 50, 32, 16 );
        // sphereGeometry.translate(33.7,-21.1,-850);
        // processAortaGeometry(sphereGeometry);
    }

    function processAortaGeometry(geometry) {
      console.log('processAortaGeometry()',geometry)
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
         // 3D mesh
          object.material = new THREE.MeshLambertMaterial({
            opacity: object.opacity,
            color: object.color,
            clippingPlanes: [],
            transparent: true,
          });
          object.mesh = new THREE.Mesh(geometry, object.material);
          object.mesh.objRef = object;
          const array = r1.stackHelper.stack.lps2IJK.toArray();

          let RASToLPS = new THREE.Matrix4();
          const worldCenter = r1.stackHelper.stack.worldCenter();
        /*
            RASToLPS.set(1, 0, 0, worldCenter.x,
                        0, 1, 0, worldCenter.y,
                        0, 0, -1, worldCenter.z,
                        0, 0, 0, -1);
            RASToLPS.set(-1, 0, 0, worldCenter.x,
                        0, -1, 0, worldCenter.y,
                        0, 0, 1, worldCenter.z,
                        0, 0, 0, 1);
          */

        //console.log('applyMatrix(RASToLPS)');
          //object.mesh.applyMatrix(RASToLPS);
          geometry.computeBoundingBox();

          r0.scene.add(object.mesh);
          globalContext.aortha = object.mesh; // убивать надо за использование глобальных переменных

          object.scene = new THREE.Scene();

          // front
          object.materialFront = new THREE.MeshBasicMaterial({
                  color: object.color,
                  side: THREE.FrontSide,
                  depthWrite: true,
                  opacity: 0,
                  transparent: true,
                  clippingPlanes: [],
          });

          object.meshFront = new THREE.Mesh(geometry, object.materialFront);
          //object.meshFront.applyMatrix(RASToLPS);
          object.scene.add(object.meshFront);

          // back
          object.materialBack = new THREE.MeshBasicMaterial({
                  color: object.color,
                  side: THREE.BackSide,
                  depthWrite: true,
                  opacity: object.opacity,
                  transparent: true,
                  clippingPlanes: [],
          });

          object.meshBack = new THREE.Mesh(geometry, object.materialBack);

          //object.meshBack.applyMatrix(RASToLPS);
          object.scene.add(object.meshBack);
          sceneClip.add(object.scene);

          onGreenChanged();
          onRedChanged();
          onYellowChanged();

          // добавляем info div поверх r0234
          // dmi - это глобальный объект, определенный в ami_quadview.js. Интормация туда попадает так:
          // initAMI() создает let loader =new AMI.VolumeLoader(..), вызывает loader.load(files)
          // и по окончании загрузке получает доступ к DICOM информации
          // let series = loader.data[0].mergeSeries(loader.data)[0];
          //  dmi.seriesInstanceUID = series.seriesInstanceUID; // x0020000e
          //  ..
          // затем loader уничтожается loader.free();, но series, по видимому, продолжают жить
          // и одна из структур series передается в AMI.BoundingBoxHelper
          //  let stack = series.stack[0];
          //  let boxHelper = new AMI.BoundingBoxHelper(stack);
          //  r0.scene.add(boxHelper);
          // Этот же stack передается еще нескольким функциям
          //  initHelpersStack(r1, stack);
          //  r0.scene.add(r1.scene);
          //  redContourHelper = new AMI.ContourHelper(stack, r1.stackHelper.slice.geometry);
          // так, что stack живет долго, а вот интересно объект series из которого он возник
          // продолжают жить после loader.free() ? и можно ли до него добраться?
          // --нет, из stack нет обратной ссылки на series
          //
          /*
          r0.dicomInfo = new DicomInfo(r0.domElement);
          r1.dicomInfo = new DicomInfo(r1.domElement);
          r2.dicomInfo = new DicomInfo(r2.domElement);
          r3.dicomInfo = new DicomInfo(r3.domElement);

          r0.dicomInfo.addTextLeft("ИД пациента: "+dmi.patientID);
          r0.dicomInfo.addTextLeft("Имя пациента: "+dmi.patientName);
          r0.dicomInfo.addTextLeft("Дата проведения исследования: "+dmi.studyDate);
          r0.dicomInfo.addTextLeft("Пол пациента: "+dmi.patientSex);
          r0.dicomInfo.addTextLeft("Возраст пациента: "+dmi.patientAge);
          r0.dicomInfo.addTextLeft("Описание исследования: "+dmi.studyDescription);
          r0.dicomInfo.addTextLeft("Описание серии: "+dmi.seriesDescription);
          r0.dicomInfo.addTextLeft("Метод исследования: "+dmi.modality);

          updateWLdicomInfo(r1);
          updateWLdicomInfo(r2);
          updateWLdicomInfo(r3);
          */

          // good to go: оповестить всех желающих, что загрузка завершилась
          ready = true;
          //stack = null;

        // DEBUG
        //console.log('r1.ijk2LPS='); console.log(r1.stackHelper.stack.ijk2LPS);
          var coord = new THREE.Vector3(256, 256, 150);

          // force 1st render
          render();
          // notify puppeteer to take screenshot
          const puppetDiv = document.createElement('div');
          puppetDiv.setAttribute('id', 'puppeteer');
          document.body.appendChild(puppetDiv);

    }
}


function render() {
  // we are ready when both meshes have been loaded
  if (ready) {
    // render
    r0.controls.update();
    r1.controls.update();
    r2.controls.update();
    r3.controls.update();

    r0.light.position.copy(r0.camera.position);
    r0.renderer.render(r0.scene, r0.camera);

    // r1
    r1.renderer.clear();
    r1.renderer.render(r1.scene, r1.camera);
    // mesh
    r1.renderer.clearDepth();
    data.forEach(function(object, key) {
      object.materialFront.clippingPlanes = [clipPlane1];
      object.materialBack.clippingPlanes = [clipPlane1];
      r1.renderer.render(object.scene, r1.camera, redTextureTarget, true);
      r1.renderer.clearDepth();
      if(redContourHelper) {
          redContourHelper.contourWidth = object.selected ? 3 : 2;
          redContourHelper.contourOpacity = object.selected ? 1 : .8;
          r1.renderer.render(redContourScene, r1.camera);
          r1.renderer.clearDepth();
      }
    });

    // localizer
    r1.renderer.clearDepth();
    r1.renderer.render(r1.localizerScene, r1.camera);

    // r2
    r2.renderer.clear();
    r2.renderer.render(r2.scene, r2.camera);
    // mesh
    r2.renderer.clearDepth();
    data.forEach(function(object, key) {
      object.materialFront.clippingPlanes = [clipPlane2];
      object.materialBack.clippingPlanes = [clipPlane2];
    });
    r2.renderer.render(sceneClip, r2.camera);
    // localizer
    r2.renderer.clearDepth();
    r2.renderer.render(r2.localizerScene, r2.camera);

    // r3
    r3.renderer.clear();
    r3.renderer.render(r3.scene, r3.camera);
    // mesh
    r3.renderer.clearDepth();
    data.forEach(function(object, key) {
      object.materialFront.clippingPlanes = [clipPlane3];
      object.materialBack.clippingPlanes = [clipPlane3];
    });
    r3.renderer.render(sceneClip, r3.camera);
    // localizer
    r3.renderer.clearDepth();
    r3.renderer.render(r3.localizerScene, r3.camera);
  }

  stats.update();

}

/**
 * Init the quadview
 */
function init() {
  /**
   * Called on each animation frame
   */
  function animate() {
    render();

    // request new frame
    requestAnimationFrame(function() {
      animate();
    });
  }

  // renderers
  initRenderer3D(r0);
  initRenderer2D(r1);
  initRenderer2D(r2);
  initRenderer2D(r3);

  // start rendering loop
  animate();
}

//
function initAMI() {
  // init threeJS
  init();
}

// рекурсивное удаление содержимого THREE.Object3D, например, сцены.
// Сам объект при этом не удаляется
//
function clearThree(obj){
  while(obj.children.length > 0){
    clearThree(obj.children[0])
    obj.remove(obj.children[0]);
  }
  if(obj.geometry) obj.geometry.dispose()
  if(obj.material) obj.material.dispose()
  if(obj.texture)  obj.texture.dispose()
}

// Эта функция освобождает данные загруженные loadPatientData() и чистит все сцены
//
function disposePatientData() {
    console.log('disposePatientData()');

    r0.scene.remove(r0.boxHelper);
    r0.boxHelper.dispose();
    r0.boxHelper = null;

    data.forEach(function(object, key) {
        //console.log('object=',object);
        clearThree(object.scene);
        object.material.dispose();
        object.material = null;
        r0.scene.remove(object.mesh);
        //object.mesh.dispose();
        object.mesh = null;
    });

    redContourScene.remove(redContourHelper);
    redContourHelper.dispose();
    redContourHelper = null;
    redTextureTarget.dispose();
    redTextureTarget = null;

    r0.scene.remove(r1.scene);
    r1.scene.remove(r1.stackHelper);
    r1.stackHelper.dispose();
    r1.stackHelper = null;
    r1.localizerScene.remove(r1.localizerHelper);
    r1.localizerHelper.dispose();
    r1.localizerHelper = null;
    //console.log('r1.renderer.info=',r1.renderer.info);
    // r1.renderer.info={geometries:2, textures:1}
    //console.log('r1.scene=',r1.scene);
    // r1.scene.children=0

    r0.scene.remove(r2.scene);
    r2.scene.remove(r2.stackHelper);
    r2.stackHelper.dispose();
    r2.stackHelper = null;
    r2.localizerScene.remove(r2.localizerHelper);
    r2.localizerHelper.dispose();
    r2.localizerHelper = null;
    //console.log('r2.renderer.info=',r2.renderer.info);

    r0.scene.remove(r3.scene);
    r3.scene.remove(r3.stackHelper);
    r3.stackHelper.dispose();
    r3.stackHelper = null;
    r3.localizerScene.remove(r3.localizerHelper);
    r3.localizerHelper.dispose();
    r3.localizerHelper = null;
    //console.log('r3.renderer.info=',r3.renderer.info);

    //console.log('r0.renderer.info=',r0.renderer.info);
    //console.log('r0.scene.children=',r0.scene.children);
    //console.log('r0.stack=',r0.stack);
    //console.log('r0.stack._frame size=',sizeOf(r0.stack._frame));
    //console.log('r0.stack._rawData=',r0.stack._rawData);
    r0.stack._frame = [];
    r0.stack._rawData = [];
}

function initDatGui() {
  return;
    let gui = new dat.GUI({
      autoPlace: false,
    });

    let customContainer = document.getElementById('my-gui-container');
    customContainer.appendChild(gui.domElement);


    // Red
    let stackFolder1 = gui.addFolder('Axial (Red)');
    let redSlider = stackFolder1.add(
      r1.stackHelper,
      'index', 0, r1.stackHelper.orientationMaxIndex).step(1).listen();

    // Yellow
    let stackFolder2 = gui.addFolder('Sagittal (yellow)');
    let yellowSlider = stackFolder2.add(
      r2.stackHelper,
      'index', 0, r2.stackHelper.orientationMaxIndex).step(1).listen();

    // Green
    let stackFolder3 = gui.addFolder('Coronal (green)');
    let greenSlider = stackFolder3.add(
      r3.stackHelper,
      'index', 0, r3.stackHelper.orientationMaxIndex).step(1).listen();

    redSlider.onChange(onRedChanged);
    yellowSlider.onChange(onYellowChanged);
    greenSlider.onChange(onGreenChanged);
}

// files - массив DICOM url
// aortaUrl - URL аорты (STL файл в binary little endian формате)
// CustomProgressBar - как показано в одном из lessons AMI
//
function loadPatientData(files, aortaUrl, CustomProgressBar) {

    console.log('loadPatientData(..)');
    //console.log(files);

  // load sequence for each file
  // instantiate the loader
  // it loads and parses the dicom image
    var container = document.createElement("div");

  let loader = new AMI.VolumeLoader(container, CustomProgressBar);
  loader.load(files)
  .then(function() {

    let series = loader.data[0].mergeSeries(loader.data)[0];

    // копируем метаинтформацию в dmi
    // Study instance UID (0020,000d)
    // Segmentation type (0062,0001)
    console.log('InitDMI');
    dmi.seriesInstanceUID = series.seriesInstanceUID; // x0020000e
    dmi.transferSyntaxUID = series.transferSyntaxUID; // x00020010
    dmi.seriesDate = series.seriesDate;               // x00080021
    dmi.seriesDescription = series.seriesDescription; // x0008103e
    dmi.studyDate = series.studyDate;                 // x00080020
    dmi.studyDescription = series.studyDescription;   // x00081030
    dmi.numberOfFrames = series.numberOfFrames;
    dmi.numberOfChannels = series.numberOfChannels;
    dmi.modality = series.modality;                   // x00080060
    dmi.patientID = series.patientID;                 // x00100020
    dmi.patientName = series.patientName;             // x00100010
    dmi.patientAge = series.patientAge;               // x00101010
    dmi.patientBirthdate = series.patientBirthdate;   // x00100030
    dmi.patientSex = series.patientSex;               // x00100040

              //console.log('dmi='); console.log(dmi);

    loader.free();
    loader = null;
    // get first stack from series
    // stack это объект класса ModelsStack (не наследник Object3D!)
    // ссылку на стек имеют многие объекты, но никто им не владеет
    // поэтому удаление стека происходит в disposePatientData()
    // для DICOM Швец (295 файлов) sizeOf(stack)= 618794024
    let stack = series.stack[0];
    r0.stack = stack;
    series = null;
    stack.prepare();

    // center 3d camera/control on the stack
    let centerLPS = stack.worldCenter();
    r0.camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
    r0.camera.updateProjectionMatrix();
    r0.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);

    initHelpers(stack);

    initDatGui();

    function onDoubleClick(event) {
      // event.target - это <canvas..>
      // event.target.parentElement - это div r1,2,3,4
      console.log('onDoubleClick');
      var rx = getAreaByEvent(event);
      console.log(rx);
      let stackHelper = rx.stackHelper;
      if(rx.domId == 'r0') stackHelper = r1.stackHelper;      // черт его знает почему

      let scene = r0.scene;
      const intersects = hit(event,scene.children);
      console.log('intersects.length='+intersects.length);
      if (intersects.length > 0) {
          console.log(intersects[0]);
        let ijk =
            AMI.UtilsCore.worldToData(stackHelper.stack.lps2IJK, intersects[0].point);

        r1.stackHelper.index =
          ijk.getComponent((r1.stackHelper.orientation + 2) % 3);
        r2.stackHelper.index =
          ijk.getComponent((r2.stackHelper.orientation + 2) % 3);
        r3.stackHelper.index =
          ijk.getComponent((r3.stackHelper.orientation + 2) % 3);

        onGreenChanged();
        onRedChanged();
        onYellowChanged();
      }
    }

    // обработчик клавиатуры
    function onKeyDown(event) {
        // event.ctrlKey event.metaKey
        console.log('onKeyDown() keyCode='+event.keyCode+' shift='+event.shiftKey);

        // 'i' - переключатель div information
        //
        if(event.key == 'i') {
            if(globalContext.infoVisible)
                $("info").style.display="none";
            else
                $("info").style.display="block";
            globalContext.infoVisible = !globalContext.infoVisible;
        }
        // ESC - возврат в 4-х оконный режим
        //
        else if(event.keyCode == 27) {
            //toggle_1or4_windows(null);    // это неотлаженная функциональность
        }
        // 'p' - planes - переключатель видимости секущих плоскостей в 3D окне
        //
        else if(event.key == 'p') {
            if(globalContext.planesVisible) {
                r0.scene.remove(r1.scene);
                r0.scene.remove(r2.scene);
                r0.scene.remove(r3.scene);
                globalContext.planesVisible = false;
            }
            else {
                r0.scene.add(r1.scene);
                r0.scene.add(r2.scene);
                r0.scene.add(r3.scene);
                globalContext.planesVisible = true;

            }
        }
    }

    // event listeners
    r0.domElement.addEventListener('dblclick', onDoubleClick);
    r1.domElement.addEventListener('dblclick', onDoubleClick);
    r2.domElement.addEventListener('dblclick', onDoubleClick);
    r3.domElement.addEventListener('dblclick', onDoubleClick);
    //document.addEventListener('keydown',onKeyDown);
    //r1.domElement.addEventListener('mousedown',function(e){console.log('event.button='+event.button);})

    // !!! этот код по видимому не используется и может быть удален
    function onClick(event) {
        if(event) return;
      console.log('function onClick(event)');

      // этот код непонятно что делает, так как обработчик onClick() установлен
      // только на r0
      const canvas = event.target.parentElement;
      const id = event.target.id;
      var canvasOffset = getOffsetRect(canvas);
      const mouse = {
        x: ((event.clientX - canvasOffset.left) / canvas.clientWidth) * 2 - 1,
        y: - ((event.clientY - canvasOffset.top) / canvas.clientHeight) * 2 + 1,
      };
      //
      let camera = null;
      let stackHelper = null;
      let scene = null;
      switch (id) {
        case '0':
          camera = r0.camera;
          stackHelper = r1.stackHelper;
          scene = r0.scene;
          break;
        case '1':
          camera = r1.camera;
          stackHelper = r1.stackHelper;
          scene = r1.scene;
          break;
        case '2':
          camera = r2.camera;
          stackHelper = r2.stackHelper;
          scene = r2.scene;
          break;
        case '3':
          camera = r3.camera;
          stackHelper = r3.stackHelper;
          scene = r3.scene;
          break;
      }

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children, true);
      if (intersects.length > 0) {
        if (intersects[0].object && intersects[0].object.objRef) {
          const refObject = intersects[0].object.objRef;
          refObject.selected = !refObject.selected;

          let color = refObject.color;
          if (refObject.selected) {
            color = 0xCCFF00;
          }

          // update materials colors
          refObject.material.color.setHex(color);
          refObject.materialFront.color.setHex(color);
          refObject.materialBack.color.setHex(color);
        }
      }
    }
    r0.domElement.addEventListener('click', onClick);

    /*  Обработка событий мыши в окне r0
     * cntrl | alt - установить точку коммиссуры
     * shift       - удалить
     * просто mousedown - попытка захвата и сдвига точки комиссуры
     * @param {MouseEvent} e
     */
      var refPoint = null;      // точка комиссуры которую захватили для движения

    function onMousedown(event) {
        //console.log('onMousedown()',e);
        return;
        // console.log('V5.viewer.getInteractive()='+V5.viewer.getInteractive());
        // if(V5.viewer.getInteractive()) {
        //     r0.controls.enabled = false;
        //     r0.domElement.addEventListener('mousemove', onMousemove);
        //     V5.viewer.mouseDown(e);
        //     return;
        // };

        if(event.ctrlKey || event.altKey)  {
            // V5.viewer.addCommissure(event);
            // V5.viewer.updateMenuButtons();
            // return;
        }
        else if(event.shiftKey) {
            // V5.viewer.deleteCommissure(event);
            // V5.viewer.updateMenuButtons();
            // return;
        }
        else {
            // просто нажатие клавиши мыши рассматриваем как попытку
            // захвата и движение точки коммиссуры
            if( globalContext.commissurePoints.length > 0) {
                let intersects = hit(event, globalContext.commissurePoints);
                if(intersects.length > 0) {
                    refPoint = intersects[0].object;
                    //console.log('захватили объект ',refPoint);
                    // запрещаем работу TrackballControl на время движения
                    r0.controls.enabled = false;
                    r0.domElement.addEventListener('mousemove', onMousemove);
                }
            }
        }
    }

    /* @param {MouseEvent} e */
    function onMousemove(e) {
        //console.log('onMousemove()');
        // if(V5.viewer.getInteractive()) {V5.viewer.mouseMove(e); return;};
        if(!refPoint) return;
        let intersects = hit(e,[globalContext.aortha]);
        if(intersects.length > 0) {
            // двигаем точку в новое место
            let point = intersects[0].point;
            refPoint.position.set(point.x, point.y, point.z);
        }
        else {
            // оторвались от поверхности - отпускаем точку
            refPoint = null;
            r0.controls.enabled = true;
        }
    }

    /* @param {MouseEvent} e */
    function onMouseup(e) {
      return;
        //console.log('onMouseup()');
        // if(V5.viewer.getInteractive()) {
        //     V5.viewer.mouseUp(e);
        //     r0.domElement.removeEventListener('mousemove', onMousemove);
        //     r0.controls.enabled = true;
        //     return;
        // };

        if(refPoint) {
            //console.log('отпустили объект ',refPoint);
            refPoint = null;
            r0.domElement.removeEventListener('mousemove', onMousemove);
            r0.controls.enabled = true;
        }
    }

    r0.domElement.addEventListener('mousedown', onMousedown);
    r0.domElement.addEventListener('mouseup', onMouseup);
    // end debug




    function onScroll(event) {
      const id = event.target.domElement.id;
      let stackHelper = null;
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

      onGreenChanged();
      onRedChanged();
      onYellowChanged();
    }

     // event listeners
    r1.controls.addEventListener('OnScroll', onScroll);
    r2.controls.addEventListener('OnScroll', onScroll);
    r3.controls.addEventListener('OnScroll', onScroll);
    window.addEventListener('resize', onWindowResize, false);

       // dataInfo - это глобальный объект, который помимо url аорты содержит
      // ссылки на различные mesh'и и др. информацию которая используется в визуализации,
      // но надо избавляться от всей этой глобальной помойки
      //
      data.forEach(function(object, key) {
            object.location = '';
            loadAortha(object);
      });

      console.log('new Event V5-DICOMLoadingEnd')
      document.dispatchEvent(new Event('V5-DICOMLoadingEnd'));


  } // loader.load(files).then(function(){
  )
  .catch(function(error) {
    window.console.log('oops... something went wrong...');
    window.console.log(error);
  });
}; // это конец функции loadPatientData

