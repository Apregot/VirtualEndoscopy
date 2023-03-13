function PlasticBoy(state, visArea) {	
	console.log('PlasticBoy()')
	this.state = state;
	this.visArea = visArea;
	this.scene = visArea.scene;
	this.input_data = null;		// инициализируется в colorTubesByFFR
	this.FFRfull = null;		// инициализируется в colorTubesByFFR
	this.rangeFFR = [];			// инициализируется в colorTubesByFFR как [min,max] расчетных значений ФРК
	this.range = [0.6,1];		// это абсолютный диапазон ФРК для раскраски красный-синий
	// this.lut = new THREE.Lut('rainbow',256) //[0,1] -> [красный,синий]
	// const legendMesh = this.lut.setLegendOn({})
	// this.scene.add(legendMesh); console.log('added legendMesh')

    this.addLUT(visArea);  
    this.divf = null;	// табличка со значением ФРК  
}

PlasticBoy.prototype.addLUT = function (visArea) {
    // вторая сцена для LUT
    visArea.camera2 = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
    visArea.camera2.position.set(0,0,4);
    visArea.light2 = new THREE.PointLight( 0xffffff );
    visArea.light2.position.set(0,100,100);
    visArea.scene2 = new THREE.Scene();
    visArea.scene2.add(visArea.light2);

    let lut, legend, labels;

    // добавляем LUT
    lut = new THREE.Lut( "rainbow1", 256 );
    //var sMin = 1, sMax = 0.6;
    // надо бы перевернуть вверх ногами
    lut.setMax( this.range[1] );
    lut.setMin( this.range[0] );
    // , 'dimensions': { 'width': 0.1, 'height': 3 }
    legend = lut.setLegendOn( { 'layout':'vertical', 'position': { 'x': 3, 'y': 0, 'z': 0 } } );

    visArea.scene2.add(legend);
    // 'um': 'Pa',
    labels = lut.setLegendLabels( { 'title': '     ФРК', 'ticks': 6 } );

    visArea.scene2.add ( labels['title'] );

    for ( var i = 0; i < Object.keys( labels[ 'ticks' ] ).length; i++ ) {

            visArea.scene2.add ( labels[ 'ticks' ][ i ] );
            visArea.scene2.add ( labels[ 'lines' ][ i ] );

    }

    this.lut = lut;
    this.legend = legend;
    this.labels = labels;

    console.log('LUT added');
}

/** 
 * Функция раскраски графа расчитанным значением ФРК
 * 
 */ 	
PlasticBoy.prototype.colorTubesByFFR = async function() {
	//console.log('colorTubeFFR()')
 	let state = this.state;

	const input_data = await parse_input_data(); //console.log('input_data',input_data)
	const FFRfull = await parse_FFRfull(); //console.log('FFRfull',FFRfull)
	this.input_data = input_data;
	this.FFRfull = FFRfull;

	// вычислим диапазон ФРК
	//
	//const f0 = Number.POSITIVE_INFINITY, f1 = Number.NEGATIVE_INFINITY
	let f0 = +Infinity, f1 = -Infinity
	const arteris = [FFRfull.LCA,FFRfull.RCA];
	for(let artery of arteris) {
		for(let rib of artery) {
			//console.log(rib)
			f0 = Math.min(f0,Math.min(...rib.ffr_value))
			f1 = Math.max(f1, Math.max(...rib.ffr_value))
		}
	}
	this.rangeFFR = [f0,f1]; //console.log(`FFR range [${f0},${f1}]`);

	// надо привязать узлы к центральной линии сосуда
	// у Почукаевой FFRfull.RCA[3] это ребро на котором установлен стеноз на "Right vessel 3"[57]
	// Right vessel 3 - это vesselInfo[5]
	/*		
		mapRibs() дает input_data.RCA.ribs[i].vesselMap = {
							vessel:vessel,
							range:[closeLeft.ind,closeRight.ind],
							dist:[closeLeft.dist,closeRight.dist]
						}
		туда же в vesselMap надо дописать tube, для участка сосуда, как это делает make_tubes()
		получить FFRfull
		раскрасить ribs[i].tube значениями FFR
	*/

    mapRibs(state, input_data);

    // const rca2 = state.vesselInfo[4], lca2 = state.vesselInfo[1]
    // собираем все трубки PlasticBoy в массив
    let plasticBoyTubes = [];
	for(let inp_artery of [input_data.LCA, input_data.RCA]) {
		for(let rib of inp_artery.ribs) {
			// if(rib.vesselMap.vessel == lca2) {
				this.makeAndColorRib(rib);
				plasticBoyTubes.push(rib.plasticTube);
			// }
		}
	}

	// здесь надо включать mouse tracking 
	const self = this;
	function onMousemove(event) {
		//console.log('onMousemove()',event);

		var canvas = event.target;
        var canvasOffset = getOffsetRect(event.target);
        const mouse = {
          x: ((event.clientX - canvasOffset.left) / canvas.clientWidth) * 2 - 1,
          y: - ((event.clientY - canvasOffset.top) / canvas.clientHeight) * 2 + 1,
        };
        let camera = self.visArea.camera;
        let scene = self.visArea.scene;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(plasticBoyTubes, true);
        if(intersects.length > 0) {
            //console.log("Hit @ " + toString( intersects[0].point) );
            const mesh = intersects[0].object;
            // tupleSize - это число faces в одном сегменте трубки
            const tupleSize = mesh.geometry.parameters['radialSegments']*2;
            //const index = mesh.geometry.getIndex()['array']
            const faceIndex = intersects[0]['faceIndex'];
            const segInd = Math.floor(faceIndex / tupleSize);
            // console.log(`tupleSize=${tupleSize} faceIndex=${faceIndex} segIndex=${segInd}`)

			let rib = null;
			for(let inp_artery of [input_data.LCA, input_data.RCA]) {
				for(let r of inp_artery.ribs) {
						if(r.plasticTube == mesh) {
							rib = r;
							break;
						}
				}
			}
			//console.log('selected rib ', rib); //return;

			const vessel = rib.vesselMap.vessel
			const arteryName = (vessel.artery == self.state.vesselsObj.LCA ? 'LCA' : 'RCA')
			const ribs = (arteryName == 'LCA' ? self.input_data.LCA.ribs : self.input_data.RCA.ribs)
			const FFRfull = (arteryName == 'LCA' ? self.FFRfull.LCA : self.FFRfull.RCA)
			const ind = ribs.indexOf(rib)

			const m = rib.vesselMap, nPts = rib.vesselMap.vessel.centerline.length/3
			const rad = rib.segDiameterCM * 5, seglen = rib.segLengthCM*10; 
			const steps = FFRfull[ind].ffr_value.length
			// console.log(`${m.vessel.name}[${m.range[0]},${m.range[1]}] of ${nPts} radius ${rad} length ${seglen} steps ${steps}`)

			const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
			const ffr = FFRfull[ind].ffr_value, numSegs = steps, ffr_value = ffr[segInd]
			//console.log(`seg ${segInd} / ${numSegs} FFR=${ffr_value}`)

			if(!self.divf) {
				self.divf = document.createElement("div");
				self.divf.style.position = 'absolute';
				self.divf.style.background = 'rgba(255,0,0, 0.5)'; // "red"
				self.divf.style.color = "white";
				self.divf.innerHTML = "Hello";
				document.body.appendChild(self.divf);			
			}

			self.divf.style.display = 'block';
			let x = event.clientX+5, y = event.clientY - 20;
			self.divf.style.left = `${x}px`;
			self.divf.style.top = `${y}px`;
			//const color = new THREE.Color(0x00ff00);
			const color = self.lut.getColor(ffr_value);
			const rgb = `rgb(${255*color.r},${255*color.g},${255*color.b})`;
			self.divf.style.background = `${rgb}`;
			self.divf.innerHTML = `${ffr_value.toFixed(2)}`;
        }
        else if(self.divf)
        	self.divf.style.display = 'none';

	}
	this.visArea.domElement.addEventListener('mousemove', onMousemove, false);
}

PlasticBoy.prototype.makeAndColorRib = function(rib) {
	//console.log('rib',rib)
	const vessel = rib.vesselMap.vessel
	const arteryName = (vessel.artery == this.state.vesselsObj.LCA ? 'LCA' : 'RCA')
	const ribs = (arteryName == 'LCA' ? this.input_data.LCA.ribs : this.input_data.RCA.ribs)
	const FFRfull = (arteryName == 'LCA' ? this.FFRfull.LCA : this.FFRfull.RCA)
	const ind = ribs.indexOf(rib)
	// console.log(`makeAndColorRib(${vessel.name} ${arteryName} rib[${ind}])`);

	const m = rib.vesselMap, nPts = rib.vesselMap.vessel.centerline.length/3
	const rad = rib.segDiameterCM * 5, seglen = rib.segLengthCM*10; 
	const steps = FFRfull[ind].ffr_value.length
	// console.log(`${m.vessel.name}[${m.range[0]},${m.range[1]}] of ${nPts} radius ${rad} length ${seglen} steps ${steps}`)

	let tube = Tubes.makeTubeMesh({
		vessel: rib.vesselMap.vessel,
		range: m.range,
		segments: steps,
		color: 0xffffff,
	})
	this.scene.add(tube);
	rib.plasticTube = tube;

	const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
	const range = this.range;
	const ffr = FFRfull[ind].ffr_value, numSegs = steps
	for(let i = 0; i < steps; i++) {
		// даже clamp делать не обязательно, LUT сам делает clamp
		//let value = clamp(ffr[i],range[0],range[1])
		// let ratio = (value-range[0]) / (range[1]-range[0]);
		//
		let value = ffr[i];
		let segColor = this.lut.getColor(value/*ratio*/);
		Tubes.colorTubeSegment(tube,i,segColor)
	}
}

// это взято из rainbow. Лучше назвать buildRibsMap, так как результатом работы этой функции является
// создание input_data.{LCA|RCA}.ribs[].vesselMap{vessel,range,dist}, позволяющее ребру графа сопоставить
// участок сосуда 'vessel' в диапазоне range[i1,i2] по центральной линии
// 
function mapRibs(state, input_data) {
	//const ribInd = 0, rib = input_data.RCA.ribs[ribInd]; //console.log('ребро стеноза',rib)
	//let vessels = [state.vesselInfo[3],state.vesselInfo[4],state.vesselInfo[5]];

	for(let inp_artery of [input_data.LCA, input_data.RCA]) {
		let m = [];
		for(let rib of inp_artery.ribs) {
			let m1 = [];
			let vessels = state.vesselInfo.filter(obj => obj.artery == (inp_artery == input_data.RCA ? 
													state.vesselsObj.RCA : state.vesselsObj.LCA))
			for(let vessel of vessels) {
				const n1 = inp_artery.nodes[rib.n1]; //console.log(node3)
				const n2 = inp_artery.nodes[rib.n2]; //console.log(node3)
				const closeLeft = checkNodeOnCenterline(state.stack, n1 ,vessel);
				const closeRight = checkNodeOnCenterline(state.stack, n2 ,vessel);
				m1.push({
					vessel:vessel,
					range:[closeLeft.ind,closeRight.ind],
					dist:[closeLeft.dist,closeRight.dist]
				})
			}

			// отсеиваем плохих кандидатов:
			// (1) расстояние больше порогового значения
			const maxDist = 2;	// от фонаря, но выглядит разумно
			let m2 = m1.filter(obj => obj.dist[0] < maxDist && obj.dist[1] < maxDist);

			m.push(m2);
		}

		// оставляем первые элементы подмассивов
		let res = m.map( val => val[0]);

		// пакуем в input_data
		// assert(res.length == input_data.RCA.ribs.length)
		for(let i=0; i<inp_artery.ribs.length; i++) 
			inp_artery.ribs[i].vesselMap = res[i];
	}

	//console.log('input_data.RCA.ribs',input_data.RCA.ribs)
}

// координаты узла n [x,y,z] являются координатами input_data, то есть в сантиметрах и без origin
//
function checkNodeOnCenterline(stack, n /* [x,y,z] */, vessel) {
    const name = vessel.name, centerline = vessel.centerline
    const s=stack['_spacing'], ijkNode=[Math.round(10*n[0]/s.x), Math.round(10*n[1]/s.y), Math.round(10*n[2]/s.z)];
    // nv это мировые координаты узла
    const nv = new THREE.Vector3(10*n[0], 10*n[1], 10*n[2]).add(stack['_origin']);
    // console.log(`rollN6alongCenterline: _vesselInfo[${vesselInd}] ${name} centerline[${centerline.length}]`);
    const nPts = centerline.length/3;

    let minDist = Infinity;
    let closePts = []//, centerlineIJK = [];
    // console.log('vessel.centerlineIJK', vessel.centerlineIJK ? '  exists' : ' not exists');
    for(let i=0; i<nPts; i++) {
        let v = new THREE.Vector3(centerline[3*i], centerline[3*i+1], centerline[3*i+2]);
        // let ijkPt = AMI.UtilsCore.worldToData(stack.lps2IJK, v);
        // centerlineIJK.push(ijkPt)
        // let dist = Math.abs(ijkPt.x-ijkNode[0]) + Math.abs(ijkPt.y-ijkNode[1]) + Math.abs(ijkPt.z-ijkNode[2]);
        let dist = nv.distanceTo(v);
        if(dist < minDist) {
        	// при равном расстоянии по пикселям учитываем евклидово расстояние
        	// const d = nv.distanceTo(v);
        	// let less = (dist < minDist) || (closePts.length && d < closePts[0].dist);
        	// if(less) {
        		closePts = [];
            	let closePt = {name:name, ind:i, dist:dist};
            	closePts.push(closePt)
        	// }
            minDist = dist;
        }           
    }

    //console.log('closePts for node ', ijkNode, closePts)
    // if(!vessel.centerlineIJK) {
    // 	console.log(`запоминаем centerlineIJK для ${name}`)
    // 	vessel.centerlineIJK = centerlineIJK;            	
    // }
    //console.log(centerlineIJK)

    return closePts[0];
}

function _v(cline,ind) {
	return new THREE.Vector3(cline[3*ind],cline[3*ind+1],cline[3*ind+2]);
}


//====================== Объект Tubes
//
var Tubes = {

	/** 
	 * Это аналог PlasticBoy.prototype.makeTubeMesh с модификациями:
	 * все параметры передаются в виде объекта props { vessel, range, radius, segments, color, opacity}
	 * то есть теперь можно задавать число сегментов, на которые делиться трубка, ее цвет и прозрачность
	 * главное отличие от старого makeTubeMesh - материал задается с 'vertexColors': THREE.VertexColors,
	 * то есть имеется возможность задавать индивидуальные цвета вершин, а не цвет трубки вцелом
	 * 
	 * @param {*} props	см. выше
	 * @return {*} mesh = THREE.TubeBufferGeometry + THREE.MeshLambertMaterial c 'vertexColors'
	 */ 	

	makeTubeMesh: function(props) {	// { vessel, range, radius, segments, color, opacity}
		// console.log('Tubes.makeTubeMesh()');
		if(!props.vessel) {
			console.log('Tubes.makeTubeMesh() props.vessel is required')
			return;
		}
		const vessel = props.vessel, nPts = vessel.centerline.length/3
		const range  = props.range || [0,nPts-1]
		const radius = props.radius || 1
		const color  = props.color || 0xFFFFFF
		const opacity = props.opacity || 0.7
		const low = range[0], upp = (range[1] + 1 < nPts ? range[1] + 1 : nPts-1)
		const nSegm = props.segments || upp-low;
		// console.log(`makeTubeMesh([${range[0]},${range[1]}]) low-upp [${low},${upp}]`)

		let points = [];
		for(let i=range[0]; i<=upp; i++)
			points.push(_v(vessel.centerline,i)) 
		let path = new THREE.CatmullRomCurve3(points)
		let geometry = new THREE.TubeBufferGeometry(path,nSegm,radius,8,false);

		const vertsNum = geometry.getAttribute( 'position' ).count;
	    let colors = new Uint8Array(vertsNum*3)
	    const vesselColor = new THREE.Color(color)
	    for(var  i=0; i<vertsNum; i++) {
	        colors[3*i+0] = 255*vesselColor.r;
	        colors[3*i+1] = 255*vesselColor.g; 
	        colors[3*i+2] = 255*vesselColor.b; 
	    }

	    geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3, true ) );    // true - normalize?
		let material = new THREE.MeshLambertMaterial( { 
	        side: THREE.DoubleSide, 
	        transparent: true, 
	        opacity: opacity,
	        'vertexColors': THREE.VertexColors,
	        }); 
		let tube = new THREE.Mesh(geometry, material);

		return tube;
	},

	/*
	 * Это раскраска сегмента трубчатой структуры с геометрией THREE.TubeBufferGeometry
	 * 
	 * @param {*} color  - Number | THREE.Color | string
	 */
	colorTubeSegment: function(mesh, segNum, color) {
		// Uint16Array(3072) 64*8=512*2=1024*3=3072 это массив индексов вершин сегментов
		// по умолчанию tube - 64 сегмента (цилиндра) где каждый срез разделен на 8 радиальных сегментов, 
		// получается 64*8 цилиндрических полосок, каждая из которых разделена на 2 треугольника, получается
		// 1024 треугольника, то есть 3072 вершины, индексы которых и записаны в Uint16Array(3072)
		// а почему тогда position.count = 585? THREE.TubeBufferGeometry:
		// каждый радиальный срез цилиндра генерит [0,radialSegments] вершин, то есть radialSegments+1 вершину
		// получатся всего срезов 64+1 и на каждом срезе 8_1 вершина 65*9=585 вершин
		// то есть индексы вершин, относящиеся к i-му сегменту tube ((radialSegments+1)*2 штук) записаны в 
		// в index[] tuple с номером i и i+1, tuple size = (radialSegments)

		if(mesh.geometry.type != 'TubeBufferGeometry') {
			console.log('colorTubeSegment works only with THREE.TubeBufferGeometry')
			return;
		}
		if(segNum >= mesh.geometry.parameters['tubularSegments']) {
			console.log(`colorTubeSegment: tube has only ${mesh.geometry.parameters['tubularSegments']} segments`)
			return;		
		}

		const vesselColor = new THREE.Color(color);	// преобразование типа если надо
		// см. детали в TubeBufferGeometry
		const tupleSize = mesh.geometry.parameters['radialSegments']*6;
		const index = mesh.geometry.getIndex()['array'], i0 = segNum*tupleSize, i1 = (segNum+1)*tupleSize
		const colors = mesh.geometry.getAttribute( 'color' )['array'];
		//console.log(`tupleSize ${tupleSize} i0 ${i0} i1 ${i1}`)
	    for(let  ind=i0; ind<i1; ind++) {
	    	let i = index[ind]; 
	        colors[3*i+0] = 255*vesselColor.r;
	        colors[3*i+1] = 255*vesselColor.g;
	        colors[3*i+2] = 255*vesselColor.b;
	    }
		mesh.geometry.attributes.color['needsUpdate'] = true;
	},

	/*
	 * Это раскраска трубчатой структуры с геометрией THREE.TubeBufferGeometry
	 * 
	 * @param {*} color  - Number | THREE.Color | string
	 */

	colorTube: function(mesh, color) {
		if(mesh.geometry.type != 'TubeBufferGeometry') {
			console.log('colorTubeSegment works only with THREE.TubeBufferGeometry')
			return;
		}
		const vesselColor = new THREE.Color(color);	// преобразование типа если надо
		const vertsNum = mesh.geometry.getAttribute( 'position' ).count;
		const colors = mesh.geometry.getAttribute( 'color' )['array'];
	    for(let i=0; i<vertsNum; i++) {
	        colors[3*i+0] = 255*vesselColor.r;
	        colors[3*i+1] = 255*vesselColor.g;
	        colors[3*i+2] = 255*vesselColor.b;
	    }
		mesh.geometry.attributes.color['needsUpdate'] = true;
	},

}