goog.require('gfk.ui.ProgressBar');
goog.require('goog.asserts');

/** Класс FFR__driver отвечает за взаимодействие с удаленным FFR-сервером, реализует запуск 
 * диалогов и взаимодействие с QuadView в процессе обработки стеноза вплоть до запуска blood.
 * FFR__driver это класс сценария обработки, то есть главный дирижер, который координирует UI и вызовы методов serverInterface 
 * Ниже serverInterface это технический класс доступа к серверу FFR, он знает протокол и т.д.
*/

// FFR__driver: в этом варианте реализует сценарий Почукаева-113 (много хардкода пока)  
//
class FFR__driver {

  /**
   * @constructor
   * @param {*} serverInterface класс FFR__protocol
   * @param {*} series AMI.SeriesModel
   */	
	constructor(serverInterface, series) {
		// console.log('FFR__driver instance created');
		this._ffrsrv = serverInterface;
		this._series = series;
		this._stack = series.stack[0]; //this._stack.frame.reverse(); // для Томск
		this._progressBar = null;
		this._aortaPreviewState = /** @type {D10StateType} */({tau:0.09, alpha:0.5, beta:0.5, gamma:500, mesh:null});
		this.vesselMesh = null;
		this.visArea = null;
		this.visScene = null;		// это надо убрать
		this.aortaPreviewMesh = null;
		this._vesselsThreshold = 20;
	}

	// Шаг-1: FFR::AortaSearch_FindAorta 
	//
	async start() {
		console.log('FFR__driver::start()');
		// здесь надо организовать запуск ATB, подключение по вебсокету, запрос фото аорты и тогда вызывать Dialog-8
		// нет подключение обеспечивает верхний уровень, передавая сюда уже подключенный serverInterface
		// задача FFR__driver - скоординировать вызовы диалогов и FFR сервера
		// TBD: Dialog-8 или FFR__driver? должен взаимодействовать с сервером
		const self = this;

    let ret_cube = await this._ffrsrv.TransferCube(this._stack, e => this.showProgress(e));
    let ret_aorta_search = await this._ffrsrv.AortaSearch_FindAorta();
    // console.log('ret_aorta_search=',hex(ret_aorta_search,32));

    // AortaSearch_FindAorta возвращает ArrayBuffer в котором находится либо <FSF::ERROR> 
    // либо <FSF::OK><FSF::Uint8Array=Blob('image/png')><FSF::Float32Array[4]={Center[3],radius}>
    // то, что заключено в угловые скобки <> передается как объекты FSF в ArrayBuffer

    let search_result = FSF.parseBuffer(ret_aorta_search);
    // console.log('search_result',search_result);
    const resp = search_result[0];	// это либо OK либо ERR
    if(!resp.result)
    	FFR.viewer.showInfoMessage(resp.reason);
    else {
			let blob = new Blob([search_result[1]], {type: 'image/png'}); 
			let d8 = new Dialog8(this._stack, blob, search_result[2])
			d8.exec(
				e => 
				{
					const circle = d8.getSelectedCircle()
					if(!circle) return;
					const radius = circle.radius.toFixed(2)
					const x = circle.center.x.toFixed(2), y = circle.center.y.toFixed(2), z = circle.center.z.toFixed(2)
					// const msg = `center=(${x},${y},${z}) radius=${radius}`
					// console.log(msg)
					if(e == "OK") self.initializeAndSegmentAorta(circle.center, circle.radius);
				});
		}
	}

	/**
	 * Шаг-2: FFR_Initialize - PrepareAortaProc - LoadAortaPreview
	 * @param {*} center THREE.Vector3
	 * @param {!number=} radius
	 */
	async initializeAndSegmentAorta(center, radius) {
		const x = center.x.toFixed(2), y = center.y.toFixed(2), z = center.z.toFixed(2), r = radius.toFixed(2)
		console.log(`FFR__driver::initializeAndSegmentAorta(${x},${y},${z},${r})`)

    // реально сервер использует только центр и радиус среза аорты
  	// поэтому передавать полные FFRSettings нет необходимости.
  	// const FFRSettings = {};

		let ret = await this._ffrsrv.Initialize(x,y,z,r);		// ответ только ok

		await this._ffrsrv.PrepareAortaProc(e => this.showProgress(e));

		// По-хорошему, сначала нужно проверить версию протокола, чтобы быть уверенным, что эта команда поддерживается
		let optimal_tau = await this._ffrsrv.GetOptimalTau();
		if (optimal_tau > 0.0)
			this._aortaPreviewState.tau = optimal_tau;

		this.aortaPreview();
	}

		// FFR_Process_LoadAortaPreview(FFR, segmCube, 10, 0.09);
		// LoadAortaPreview вызывается в Диалоге-10 при движении слайдера (параметр tau)
		// на каждом вызове возвращается битовая воксельная маска аорты
		//disposePatientData();

	async aortaPreview() {
		console.log('Aorta preview step')

		// инициализация visArea - объединенное окно quadview
		//
		if(!this.visArea) {
	    let visRef = $("r0").parentNode;
      $("r0").style.display="none";
      $("r1").style.display="none";
      $("r2").style.display="none";
      $("r3").style.display="none";

      this.visArea = UP3.enable(visRef);
      UP3.initRenderer3D(visRef);
      UP3.render(visRef);
		}

		let d10 = new Dialog10(this._ffrsrv, this._aortaPreviewState, this.visArea);
		d10.exec(e => {
			if(e == 'ok') {
				// тут прямо все колхозное! ffr driver знает внутреннюю структуру диалогов
				// как то это все неправильно. Может d10 передавать UP3 в которой он должен рендерить,
				// а инициализировать ее будет ffr driver? Но опять же фокусировка камеры зависит от сцены. 
				this.visScene = d10.visArea.scene;

				this.aortaPreviewMesh = d10.aortaPreviewMesh;

				this._aortaPreviewState = d10.getState();

				this.step3();
			}
			else {

			}
		});
	}

	async step3() {
		const tau=this._aortaPreviewState.tau, alpha=this._aortaPreviewState.alpha;
		const beta=this._aortaPreviewState.beta, gamma=this._aortaPreviewState.gamma;
		console.log('step3('+tau+','+alpha+','+beta+','+gamma+') starts'); //return;

		// Шаг 3
		//
    // ffrsrv.PrepareVesselsProc(VesselsSegmParameters params = {0.09, 0.5, 0.5, 500.}, progress) -> "fin"
    // ffrsrv.SetVesselsSeeds() -> "ok"
    // ffrsrv.LoadVesselsPreview(20.); -> Blob Format Y full dims с воксельной маской сосудов

  	let t0 = performance.now();
  	console.log('calling PrepareVesselsProc')
  	await this._ffrsrv.PrepareVesselsProc(this._aortaPreviewState, e => this.showProgress(e))
  	console.log('PrepareVesselsProc returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');

  	// пользователь может установить дополнительные сиды для сегментации сосудов
  	// но в сценарии Почукаева-113 это не используется. Какой диалог задействуется?

  	await this._ffrsrv.SetVesselsSeeds();
  	console.log('SetVesselsSeeds returns',performance.now())

	// Загружаем сглаженную аорту с помощью LoadAortaObject для более информативного отображения коронаров
	t0 = performance.now();
	let aortaObj = await this._ffrsrv.LoadAortaObject();
	console.log('LoadAortaObject returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');
	let obj = FSF.parseBuffer(aortaObj); //console.log('obj',obj);
	let aortaCube = new Cube(obj[0],'aorta');
	let aortaGeometry = aortaCube.geometry();
	var aortaMesh = new THREE.Mesh(aortaGeometry, new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide }));

	// Вставляем в сцену новую аорту, а старую удаляем
	let scene = this.visArea.scene;
	scene.add(aortaMesh);
	scene.remove(this.aortaPreviewMesh);
	this.aortaPreviewMesh = aortaMesh;

  	let d11 = new Dialog11(this._ffrsrv, this.visArea);
  	d11.exec(e => {
  		console.log(e)
  		if(e == 'cancel') {
  			this.aortaPreview();
  			return;
  		}
  		// переходим на шаг 4
  		this._vesselsThreshold = d11.getVesselsThreshold();
			// this.visScene.remove(this.aortaPreviewMesh);
			this.visScene.remove(d11.vesselMesh);
			this.step4();
  	});
	}

   loadBlobAsUint8Array(file) {
      console.log('loadAortaMask()',file);
      return new Promise(function(resolve, reject) {
        let reader = new FileReader();
        reader.onload = function() {
          console.log('res=',reader.result);
          let mask = new Uint8Array(/** @type {ArrayBuffer} */ (reader.result));
          resolve(mask);
        };
        reader.onerror = function() {
            console.log(reader.error);
            reject(reader.error);
        };

        reader.readAsArrayBuffer(file);
      });      
   }


   // входными параметрами являются this._aortaPreviewState и this._vesselsThreshold - то что вернули Dialog-10 и 11
   //
	async step4() {

    	console.log('---------------------start step 4----------------- ')

		// Шаг 4 Диалог маркировки стеноза
		//
		// int retcode = FFR_Process(FFR,cube,my_update_progres,completeParameters);
		// FFR_LoadAortaObject(FFR,segmCube,10);
		// int objectsCount = FFR_GetVesselsObjectsCount(FFR);
		// foreach i FFR_LoadVesselsObject(FFR,segmCube,10,i);
		// int vesselsCount = FFR_GetVesselsCount(FFR);
		// foreach i
		//   FFR_GetVesselInfo(FFR,vesselIndex,&centerLineCount,&bifurcationsCount,name);
		//   FFR_GetVesselBifurcations(FFR,vesselIndex,points,bifurcationsCount);
		//   FFR_GetVesselCenterLine(FFR,vesselIndex,points,centerLineCount);
		// 
    // ffrsrv.Thinning(CompleteParameters params = {{0.09,0.5,0.5,500},20}, progress) -> "fin" + retcode
    // ffrsrv.LoadAortaObject() -> Blob
    // ffrsrv.GetVesselsObjectsCount() ->int
    // ffrsrv.LoadVesselsObject() -> Blob
    // ffrsrv.GetVesselsCount() ->int
    // ffrsrv.GetVesselInfo(ind) ->string
    // ffrsrv.GetVesselBifurcations(ind) -> Blob with Float64Array (untagged) Это Points3D[]
    // ffrsrv.GetVesselCenterLine(ind)   -> Blob with Float64Array (untagged) Это Points3D[]

  	let t0 = performance.now();
  	let retcode = await this._ffrsrv.Thinning(this._aortaPreviewState, this._vesselsThreshold,  e => this.showProgress(e));
  	console.log('Thinning returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');

  	// аорта передается правильно как bitmask with ROI
  	t0 = performance.now();
  	let aortaObj = await this._ffrsrv.LoadAortaObject();
  	console.log('LoadAortaObject returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');
    let obj = FSF.parseBuffer(aortaObj); //console.log('obj',obj);
    let aortaCube = new Cube(obj[0],'aorta');

		//---------------------------------------------------
		// читаем воксельные маски сосудов (левого и правого)
		// пока только сравниваем nonzero-stats для контроля
		// сохранять и объединять с аортой будем потом
		//---------------------------------------------------

		let vesselObjectsCount = await this._ffrsrv.GetVesselsObjectsCount();
		//console.log('vesselObjectsCount',vesselObjectsCount)

		// let vesselMask = [];
		// это старый способ
		// for(let i=0; i<vesselObjectsCount; i++) {
		// 	let vesselBlob = await this._ffrsrv.LoadVesselsObject(i);
		// 	let mask = await this.loadBlobAsUint8Array(vesselBlob);
		// 	vesselMask.push(mask)
		// 	// await nonzero_stats(vesselBlob);
		// }
		// console.log('vesselMask',vesselMask)

		// это новый способ
		let vesselCube = [];
		for(let i=0; i<vesselObjectsCount; i++) {
			let vesselData = await this._ffrsrv.LoadVesselsObject(i);
			let obj = FSF.parseBuffer(vesselData);
			vesselCube.push(new Cube(obj[0],'vessel'+i));
		}
		//console.log('vesselCube',vesselCube)

		let visScene  = this.visArea.scene;
	  // убираем объекты со сцены
    for(let i=0; i<visScene.children.length; i++)
    	if(visScene.children[i].type == 'Mesh')
	      visScene.remove(visScene.children[i]);
		// console.log('this.visArea.scene',this.visArea.scene);

  	console.log('---------------------step 4 finished----------------- ')
  	let v = await this.getVesselInfo()

		console.log('calling processMarkStenosis');
		let state4Obj = {stack:this._stack, aortaCube:aortaCube, vessels: vesselCube, vesselInfo: v};
		FFR.viewer.processMarkStenosis(state4Obj)
	}

	/** 
	 *  Выделение этого шага из общей цепочки сценария драйвера связано
	 *  с активацией возможности удалить сосуд в VesselListComponent
	 *  При этом происходит изменение количества сосудов и их переименование
	 *  то есть нужно обновить список сосудов и объекты в QuadView
	 * 
	 *  @return Array<*>		// {name:String, burificationPoints:Float64Array, centerline:Float64Array}
	 */
	async getVesselInfo() {
		console.log('ffrdriver.getVesselInfo()')

		//------------------------------------------------------------------------------
		// читаем информацию о сосудах - массивы точек Burification и Centerline
		// отдельно длины массивов не спрашиваем, так как она определяется автоматически
		//------------------------------------------------------------------------------

		let vesselsCount = await this._ffrsrv.GetVesselsCount();
		//console.log('vesselsCount',vesselsCount)

		//console.log('getting vessel info')

		let vesselInfo = [];

		for(let i=0; i<vesselsCount; i++) {
			let info = await this._ffrsrv.GetVesselInfo(i);	
			// info: centerLineCount bifurcationsCount name
			let parts = info.split(' '); parts.splice(0,2);
			info = parts.join(' ');
			let burPoints, centerlinePoints;
			let blob = await this._ffrsrv.GetVesselBifurcations(i);
			if(blob instanceof Blob) {
				burPoints = await blobAsFloat64Array(blob);
				// if(i == -1)
				// 	console.log('GetVesselBifurcations',i,burPoints)
				// else
				// 	console.log('GetVesselBifurcations ind #points',i,burPoints.length/3)
			}

			blob = await this._ffrsrv.GetVesselCenterLine(i);
			if(blob instanceof Blob) {
				centerlinePoints = await blobAsFloat64Array(blob);
				// if(i == -1)
				// 	console.log('GetVesselCenterLine',i,burPoints)
				// else
				// 	console.log('GetVesselCenterLine ind #points',i,burPoints.length/3)
			}

			vesselInfo.push({name:info, burificationPoints:burPoints, centerline:centerlinePoints})
		}

		// console.log('vesselInfo', vesselInfo)

		return vesselInfo;
	}

	// показать Progress Bar
	//
	showProgress(msg) {
		let self = this;
		// msg: %f text
		//console.log('showProgress('+msg+')');
		let part = msg.split(' ');
		if(part.length > 1) {
			let persent = (parseFloat(part[0])*100).toFixed(1);
			part.shift();
			let what = part.join(' ');
			if(!self._progressBar) {
				self._progressBar = new gfk.ui.ProgressBar();
				self._progressBar.setTitle(what)
				self._progressBar.show();
			}
			self._progressBar.setValue(persent);
			if(what == 'fin') {
				this.hideProgress();
			}
			else
				self._progressBar.setMessage(what);
		}
		else
			console.log('showProgress(): неверный формат: ',msg);
	}

	// скрыть Progress Bar
	//
	hideProgress() {
		if(this._progressBar) {
			this._progressBar.close();
			this._progressBar = null;			
		}
	}

	// Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array
	//
	async WS_test() {
		//et  view = new Uint8Array([33+64,0,0,12, 208, 159, 209, 128, 208, 184, 208, 178, 208, 181, 209, 130]);
		//let view = new Uint8Array([7,0,0,1,0,1,0,1,1]);
		// let  view = new Uint8Array([33+64,0,0,12, 208, 159, 209, 128, 208, 184, 208, 178, 208, 181, 209, 130,  7,0,0,1,0,1,0,1,1]);
		// let parts = FSFparse(view);
		// let pp =["first"]
		// pp = pp.concat(parts)
		// console.log('view3',pp);

		// let blob = await this._ffrsrv.sendRequest("test stream string");
		// let view = await blobAsUint8Array(blob);
		// console.log('view',Uint8ArrayToHex(view));
		// let res = FSFparse(view);
		// console.log('res',res)

		// blob = await this._ffrsrv.sendRequest("test stream cube");
		// view = await blobAsUint8Array(blob);
		// console.log('view',Uint8ArrayToHex(view));
		// res = FSFparse(view);
		// console.log('res',res)

		// res = await this._ffrsrv.sendRequestFSF("test stream string+cube")
		// console.log('res',res)

		let res = await this._ffrsrv.sendRequestFSF("test stream cube")
		console.log('res',res)
	}
}	// class FFR__driver

// data - Uint8Array в FFR Stream Format (FSF) формате см. ffr-protocol-binary.doc
// если data - это multipart FSF, то возвращается fin последней части 
function FSFparse(data) {
	//console.log('FSFparse',data);
	const F = (1<<6);
	let parts = []
	if(data.length == 0) return [{fin:true, result:null}];
	let len = 0;
	for(let offset = 0; offset < data.length; offset += len) {
		let res, elemSize, byteSize;
		let fin = ((data[offset] & F) != 0);
		let marker = data[offset] & ~F;
		if(marker == 33 /*0x21*/) { // string
			len = data[offset+2]*256+data[offset+3];
			res = fromUTF8Array(data,offset+4,len);
			len += 4;	// маркер == 4 байта
		}
		else if(marker == 7 || marker == 11) {	// Uint8[] или Int16[] dims=3
			let cube ={dims:[], data};
			let n1 = data[offset+2]*256+data[offset+3];
			let n2 = data[offset+4]*256+data[offset+5];
			let n3 = data[offset+6]*256+data[offset+7];	
			cube.dims = [n1,n2,n3];
			elemSize = (marker == 7 ? 1 :  marker == 11 ? 2 : undefined);
			len = n1*n2*n3; byteSize = len * elemSize;
			cube.data = (	marker == 7 ?
								new Uint8Array(data.buffer,offset+8,len)
							: marker == 11 ?
								new Int16Array(data.buffer,offset+8,len) 
							: null
						);
			res = cube;
			len = (8 + byteSize); 	// маркер == 8 байт
		}
		else if(marker == 29) {	// 0x1D Float64Array[] dims=1
			let n1 = data[offset+2]*256+data[offset+3];	
			len = n1;
			let cube ={dims:[n1], data};
			cube.data = new Float64Array(data.buffer,offset+8,len);	
			res = cube;
			len = n1*8 + 8;	// маркер == 8 байт
		}
		else if(marker == 60) {	// это либо EOS - End of Stream, либо PAD
			//console.log('FSFparse::Special marker type 0xF')
			if(fin) {
				parts.push({fin: true, result: null});
				break;
			}
			else {	// PAD - 1 байтовый маркер PADDING
				len = 1;
				continue;
			}
		}
		else {
			// неизвестный маркер, надо прекращать парсинг
			fin = true;
			res = "error: неизвестный маркер  "+marker+" в потоке";
			parts.push({fin: fin, result: res});
			break;
		}

		parts.push({fin: fin, result: res});
	}
	return parts;
}

function nonzero_stats(blob) {
	
	return new Promise(function (resolve, reject) {
		let fileReader = new FileReader();
		let targetcode = 1; 

		fileReader.onload = function(event) {
			 let arrayBuffer = fileReader.result;
			// рассматриваем blob как Uint8Array
			let view = new Uint8Array(/** @type {ArrayBuffer} */(arrayBuffer));	
			let non0 = {total:view.length,nonzero:0,first:-1,last:-1};
			for(let i=0; i<view.length; i++) {
				if(view[i] == targetcode) {
					if(non0.first == -1) non0.first = i;
					if(i > non0.last)	 non0.last = i;
					non0.nonzero++;
				}
			}
			console.log('nonzero-stats: ',non0);
			resolve();
		};	

		fileReader.readAsArrayBuffer(blob);

	});
}

function blobAsFloat64Array(blob) {
    return new Promise(function (resolve, reject) {
		let fileReader = new FileReader();

		fileReader.onload = function(event) {
			let view = new Float64Array(/** @type {ArrayBuffer} */(fileReader.result));	
			resolve(view);
		};	

		fileReader.readAsArrayBuffer(blob);
	});
}

function blobAsUint8Array(blob) {
    return new Promise(function (resolve, reject) {
		let fileReader = new FileReader();

		fileReader.onload = function(event) {
			let view = new Uint8Array(/** @type {ArrayBuffer} */(fileReader.result));	
			resolve(view);
		};	

		fileReader.readAsArrayBuffer(blob);
	});
}

function  Uint8ArrayToHex(arr) {
	let str = "";
	let len = (arr.length < 16 ? arr.length : 10);
	for(let i=0; i<len; i++)
		str += " 0x"+arr[i].toString(16);
	if(len < arr.length)
		str += "...";
	return str;
}


// https://gist.github.com/joni/3760795
function fromUTF8Array(data, offset, length) { // array of bytes
    var str = '',
        i0 = (offset ? offset : 0), maxInd = i0 + (length ? length : data.length);

    for (var i = i0; i < maxInd; i++) {
        var value = data[i];

        if (value < 0x80) {
            str += String.fromCharCode(value);
        } else if (value > 0xBF && value < 0xE0) {
            str += String.fromCharCode((value & 0x1F) << 6 | data[i + 1] & 0x3F);
            i += 1;
        } else if (value > 0xDF && value < 0xF0) {
            str += String.fromCharCode((value & 0x0F) << 12 | (data[i + 1] & 0x3F) << 6 | data[i + 2] & 0x3F);
            i += 2;
        } else {
            // surrogate pair
            var charCode = ((value & 0x07) << 18 | (data[i + 1] & 0x3F) << 12 | (data[i + 2] & 0x3F) << 6 | data[i + 3] & 0x3F) - 0x010000;

            str += String.fromCharCode(charCode >> 10 | 0xD800, charCode & 0x03FF | 0xDC00); 
            i += 3;
        }
    }

    return str;
}

function addSphereAtPoint(scene, point) {
  var sphereGeometry = new THREE.SphereGeometry( 50, 32, 16 );
  var faceColorMaterial = new THREE.MeshBasicMaterial({color:0x0000ff});
  var sphere = new THREE.Mesh( sphereGeometry, faceColorMaterial );
  sphere.position.set(point.x, point.y, point.z);
  scene.add(sphere);
  return sphere;
}


class AMIVolumeLoaderProgressBar  {
    constructor(container) {      
      this._progressBar = new gfk.ui.ProgressBar();
      this._progressBar.show();
    }
    // update 105447424 235701560 load http://localhost/Почукаева/DICOM/PA1/ST1/SE2/IM1..
    // update 235701560 235701560 load http://localhost/Почукаева/DICOM/PA1/ST1/SE2/IM
    // update 14 449 parse http://localhost/Почукаева/DICOM/PA1/ST1/SE2/IM1..
    // update 449 449 parse http://localhost/Почукаева/DICOM/PA1/ST1/SE2/IM1
    update(value, total, mode, url) {
      this._progressBar.setMessage(mode);
      this._progressBar.setTitle(url);
      let percent = Math.round(value/total * 100);
      // console.log('percent',percent)
      this._progressBar.setValue(percent);
      if(mode == 'parse' && value === total) {
        this._progressBar.close();
        // self._progressBar = null;
      }
      // console.log('update',value, total, mode, url)
    }
    // почему-то free не вызывается --он вызывается только при loader.free()
    free() {}
};


    /**
     * Этa функция возвращает новую серию, обрезанную до указанного диапазона bounds
     * @param {*} series AMI.SeriesModel
     * @param {!Array<Array<number>>} bounds [[x0,x1],[y0,y1],[z0,z1]]
     * @return {*} AMI.SeriesModel
     */ 
function seriesResize(series, bounds) {
    	// нельзя пользоваться ._columns ._rows _numberOfFrames
    	// const limits = [series.stack[0]._columns, series.stack[0]._rows, series.stack[0]._numberOfFrames]
    	// в min варианте они превращаются в undefined    	
    	const dims = series.stack[0].dimensionsIJK, limits = [dims.x, dims.y, dims.z]
    	const l = `limits=[${limits[0]},${limits[1]},${limits[2]}]`
    	const b1 = `[${bounds[0][0]}-${bounds[0][1]}]`
    	const b2 = `[${bounds[1][0]}-${bounds[1][1]}]`
    	const b3 = `[${bounds[2][0]}-${bounds[2][1]}]`
    	const b = `bounds=[${b1},${b2},${b3}]`
    	console.log(`seriesResize(): ${b} ${l}`)

    	const inrange = (num, min, max) => (min <= num && num < max);
			// const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
    	let boundsValid = bounds.length == 3;
    	for(let i=0; i<3; i++) 
    		if(bounds[i].length == 2) {
    			boundsValid &= (bounds[i][0] <= bounds[i][1]); 
	    		boundsValid &= inrange(bounds[i][0],0,limits[i]);
	    		boundsValid &= inrange(bounds[i][1],0,limits[i]);
    		}    									    								

      console.assert(boundsValid, `bounds valid ${b} ${l}`);
      if(!boundsValid) return null;

      /*
       * Что меняется в фрейме при изменении размерности по XY (см. AMI models.frame.js)
       * _rows _columns _dimensionIndexValues? _imagePosition _pixelPaddingValue?
       * _pixelData _windowCenter&_windowWidth? _minMax? _dist? _index?
       * _index: есть только get/set смысл неясен, надо смотреть как используется
       * см AMI loaders.volume.js parseFrame()
       * получается, что index - это индекс фрейма в стеке? (или в парсере?), то есть при
       * прореживании его надо корректировать. Нет, по факту у всех index = 0
       * _pixelData это Int16Array
       * у Домаскина spacing по Z отсутствует, но _dict играет роль Z в _imagePosition
       * итак при изменении размерности по XY надо в фрейме:
       * 1) делать глубокую копию _pixelData
       * 2) корректировать _rows _columns _imagePosition[0,1], скорее всего _minMax
       * AMI models.stack.js
       * _numberOfFrames _rows _columns  _minMax? _dimensionsIJK -- это stack.prepare():
       * _rawData - этим управляет stack.pack() корорая готовит текстуры по стеку фреймов
       * ее вызывает helpers.stack.js если !stack.packed
       * 
       * 
       */

      // создаем копию AMI.SeriesModel
      let newSeries = new AMI.SeriesModel();
      for (let key in series) 
          newSeries[key] = series[key];

      // создаем копию стека. для массива frame[] создаем собственную копию
      let oldStack = series.stack[0], newStack = new AMI.StackModel();
      for (let key in oldStack) 
          newStack[key] = oldStack[key];
      newStack.frame = [];

      for(let zInd = bounds[2][0]; zInd <= bounds[2][1]; zInd++) {
      		const resizedFrame = frameResize(oldStack.frame[zInd],bounds[0],bounds[1])
      		newStack.frame.push(resizedFrame)      		
      }
      	
      newStack.prepare();
      newSeries.numberOfFrames = newStack['_numberOfFrames'];
      newSeries.stack = [newStack];

      // console.log('прореженная серия',newSeries)
      // console.log('исходная серия',series)  
      // console.log('старый стек',oldStack.frame[0].imagePosition,oldStack.ijk2LPS)
      // console.log('новый стек',newStack.frame[0].imagePosition, newStack.ijk2LPS)

      return newSeries;
    }

/**
 * Этот метод возвращает копию фрейма, обрезанного до указанного диапазона по XY
 * сюда bounds приходят проверенные
 * @param {*} srcFrame AMI.FrameModel
 * @param {!Array<number>} boundsX [x0,x1] 
 * @param {!Array<number>} boundsY [y0,y1] 
 * @return {*} AMI.FrameModel
 * 0 <= x0<=x1 < srcFrame.columns; 0 <= y0<=y1 < srcFrame.rows
 * в новом фрейме делается глубокая копия полей imagePosition minMax pixeData 
 * и поправляется columns и rows
 */
function frameResize(srcFrame,boundsX,boundsY) {

	const columns = boundsX[1] - boundsX[0] + 1
	const rows = boundsY[1] - boundsY[0] + 1

	// создаем полу-глубокую копию исходного фрейма:
	// Поля frame.{imagePosition minMax pixeData} глубоко копируются
	// поле imageOrientaion можно оставить разделяемым.

  let frame = Object.assign(new AMI.FrameModel(), srcFrame)
  frame["imagePosition"] = srcFrame["imagePosition"].slice();
  frame["minMax"] = srcFrame["minMax"].slice();

  console.assert(frame["imagePosition"] != srcFrame["imagePosition"],'assert imagePosition')
  console.assert(frame["minMax"] != srcFrame["minMax"], 'assert minMax')

	let pixelData = new Int16Array(columns * rows)
	let i = 0

	for(let y = boundsY[0]; y <= boundsY[1]; y++)
	    for(let x = boundsX[0]; x <= boundsX[1]; x++)
	        pixelData[i++] = srcFrame["pixelData"][y*srcFrame["columns"]+x]
	    
	frame["rows"] = rows;
	frame["columns"] = columns;        
	frame["pixelData"] = pixelData;

	//console.log(`changing imagePosition X=${frame.imagePosition[0]} to ${frame.imagePosition[0] + boundsX[0] * frame.pixelSpacing[0]}`)
	frame["imagePosition"][0] += boundsX[0] * frame["pixelSpacing"][0]
	//console.log(`changing imagePosition Y=${frame.imagePosition[1]} to ${frame.imagePosition[1] + boundsY[0] * frame.pixelSpacing[1]}`)
	frame["imagePosition"][1] += boundsY[0] * frame["pixelSpacing"][1]

	return frame
}

