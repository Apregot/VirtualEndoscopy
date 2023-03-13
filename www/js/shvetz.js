// это экспериметны в ноябре 2021 по раскраске поверхности аорты Швец кривизнами в рамках подготовки отчета РНФ
//
let context = {
	cube: null,
	geom:null,
	frame_k:[],
	frame_i:[],
	frameMapByLin:null,		// map линейный индекс вокселя -> номер фрейма; то есть обратное к frame_i[]
	lut: null,
}
function shvetz(cube, frame_i, frame_k) {
	console.log('shvetz()')

    shvetzCube = cube;               
    // shvetzCube.nonzerostats(); //console.log('shvetzCube',shvetzCube); 

    // сделаем обратный mapping: линейный индекс вокселя -> индекс фрейма
    // линейный индекс хранился в frame.i и был передан как frame_i[] и он раскладывается на XYZ
    // то есть этот map позволит быстро(?) найти соответствие XYZ->номер фрейма т.е. frame.K
    let frameMap = new Map();
    for(let ii=0; ii<frame_i.length; ii++) 
        frameMap.set(frame_i[ii],ii);

    let lut = [], lutbasket = [];
    const numberofcolors = 256;
    const step = 2.0 / numberofcolors;
    for(let i=0; i<numberofcolors/2; i++) {
        var minColor = new THREE.Color( 0x0000ff )  // blue
        var maxColor = new THREE.Color( 0xffffff )  // white
        lut.push(minColor.lerp( maxColor, i*step ));
        lutbasket.push(0);
    }
    for(let i=0; i<numberofcolors/2; i++) {
        var minColor = new THREE.Color( 0xfffffe )  // white
        var maxColor = new THREE.Color( 0xff0000 )  // red
        lut.push(minColor.lerp( maxColor, i*step ));
        lutbasket.push(0);
    }

    context.cube = cube;
    context.frame_k = frame_k.slice(0);
    context.frame_i = frame_i.slice(0);
    context.frameMapByLin = frameMap;    
    context.lut = lut;

    for(let i=0; i<frame_k.length; i++) {
        let k = math.erf(frame_k[i]/0.001);
        if(k > 0.8) k = 0.0;
        // if(k < -0.95) k = 0.0;
        frame_k[i] = k;
    }

    // посчитаем min/max по кривизнам
    // minK и maxK являются глобальными и используются ниже в sanitycheck() и других функциях
    let minK = frame_k[0], maxK = minK;
    for(let i=0; i<frame_k.length; i++) {
        if(minK > frame_k[i]) minK = frame_k[i];
        if(maxK < frame_k[i]) maxK = frame_k[i];
    }
    console.log('min/max K',minK, maxK)

    // разбросать кривизны по корзинам
    function stat_1(frame_k) {
        // console.log('frame_k',frame_k)
        const n = 100;
        const range = maxK - minK;
        let basket = Array(n).fill(0);
        for(let i=0; i<frame_k.length; i++) {
            let ind = Math.floor((frame_k[i] - minK) / range * n);
            if(ind < 0 || ind >= n) {
                console.log('bad ind ',ind)
                continue;
            }
            basket[ind]++;
        }
        console.log('basket', basket)
    }

    // корзины +-
    function stat_2(frame_k) {
        // console.log('frame_k',frame_k)
        const n = 100;
        const rangeM = -minK, rangeP = maxK;
        let basketM = Array(n).fill(0), basketP = Array(n).fill(0);
        let cntM=0, cntP=0, cntBad=0, inBaskets=0;
        for(let i=0; i<frame_k.length; i++) {
            if(frame_k[i] < 0) {
                let ind = Math.floor((-frame_k[i]) / rangeM * n);
                if(ind < 0 || ind >= n) cntBad++;
                basketM[ind]++;
                inBaskets++;
            }
            else {
                let ind = Math.floor((frame_k[i]) / rangeP * n);
                if(ind < 0 || ind >= n) cntBad++;
                basketP[ind]++;
                inBaskets++;
            }
        }
        console.log('basket', basketM, basketP, cntBad,frame_k.length,inBaskets)
    }

    function sanitycheck(cube, frame_i,frame_k) {
        let goodCnt = 0, badCnt = 0, colorCnt = 0;


        // let blue = []
        // lut.forEach(item => blue.push(item.getHexString())); console.log('blue',blue)

        let geom = cube.geometry(); context.geom = geom;
        const position = geom.getAttribute( 'position' ); console.log('position',position)
        let colors = new Float32Array(position.count*3)

        console.log('searching ', position.count, ' positions')
        for(let i=0; i</*10000*/position.count; i++) {
            // if(i%1000 == 0) console.log('.')
			let ind = surfaceInd(context,i);
            // один из индексов должен быть -1, а другой нет
            if(ind != -1) {
                const k = frame_k[ind]; // должен быть в диапазоне [minK,maxK]
                let lutind = Math.floor(((k-minK) / (maxK - minK))*numberofcolors);
                // почему-то иногда встречается 256
                if(lutind >= numberofcolors) lutind = numberofcolors-1;
                if(!(lutind >= 0 && lutind < numberofcolors) )
                    console.log('wrong lutind ',lutind)
                else {
                    const color = context.lut[lutind];
                    lutbasket[lutind]++;
                    colors[3*i+0] = color.r; 
                    colors[3*i+1] = color.g; 
                    colors[3*i+2] = color.b; 
                    colorCnt++;
                }

                goodCnt++;
            }
            else {
                badCnt++;
                if(badCnt < 2) {
                    console.log('пример плохого пикселя i=',i)
                }
            }
        }
        console.log('sanitycheck goodCnt=',goodCnt,' badCnt=',badCnt, 'colorCnt=',colorCnt)
        // console.log('lutbasket',lutbasket)
        geom.addAttribute( 'color', new THREE.Float32BufferAttribute(colors, 3) );
        return geom; 
    }

    let geom = sanitycheck(shvetzCube,frame_i,frame_k);
    // stat_1(frame_k)
    // stat_2(frame_k)
    // return;

    function  enableVisArea() {
        console.log('enableVisArea()')
        let visRef = document.getElementById("r0").parentNode;
        document.getElementById("r0").style.display="none";
        document.getElementById("r1").style.display="none";
        document.getElementById("r2").style.display="none";
        document.getElementById("r3").style.display="none";

        const visArea = UP3.enable(visRef);
        UP3.initRenderer3D(visRef);
        return visArea;
      }


    // const r0 = UP3.getEnabledElement('r0',true);
    const r0 = enableVisArea();
    let shvetzMesh = new THREE.Mesh(geom, 
        new THREE./*MeshBasicMaterial*/MeshLambertMaterial ( { 'vertexColors': THREE.VertexColors, /*color: 0x00fafa,*/
         side: THREE.DoubleSide /* , transparent: true, opacity: 0.5, */}));
    r0.scene.add(shvetzMesh);
    // let centerLPS = new THREE.Vector3(256,256,95);  // это не LPS это IJK для dims=[512,512,190]
    let centerLPS = new THREE.Vector3(311,235,122);  // это не LPS это IJK ROI center
    r0.camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
    r0.camera.zoom = 5;
    r0.camera.updateProjectionMatrix();
    r0.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);
    UP3.render(r0.domElement)

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


    function onDoubleClick(event) {
          // event.target - это <canvas..>
          // event.target.parentElement - это div r1,2,3,4
          console.log('onDoubleClick',event);
          var rx = r0;

          let scene = r0.scene;
          const intersects = hit(event,scene.children);
          // console.log('intersects.length='+intersects.length);
          if (intersects.length > 0) {
              // console.log(intersects[0]);
              // console.log(intersects[0].point)
              // console.log(intersects[0].face)
              const a = intersects[0].face.a, b = intersects[0].face.b, c = intersects[0].face.c;
              // console.log('intersects abc=',a,b,c)
              const positions = geom.getAttribute( 'position' ).array;
              const colors = geom.getAttribute( 'color' ).array
              let x = positions[3*a+0], y = positions[3*a+1], z = positions[3*a+2];
              // console.log(x,y,z)
              const color = event.ctrlKey ? new THREE.Color(0xffffff) : new THREE.Color(0x00ff00);
              const cols = [new THREE.Color(0x00ff00), new THREE.Color(0x0000ff), new THREE.Color(0xff0000),
              		new THREE.Color(0x00ffff), new THREE.Color(0xff00ff), new THREE.Color(0xffff00)];
              // let spot = get_all_positions(geom, a);
              // console.log('spot',spot)
              // spot.forEach( (item,i) => color_face(geom,item,cols[i%6]))
              // console.log('a',vertex_curvature(context, a))
              // console.log('b',vertex_curvature(context, b))
              // console.log('c',vertex_curvature(context, c))
              // wave_i(context,a)
              // color_i(context,a)
              wave(context,a,color)
          }
        }

    r0.domElement.addEventListener('dblclick', onDoubleClick);
}

// posInd это индекс одной из точек (триплетов) грани по массиву positions
function color_face(geom, posInd, color) {
	// console.log('color_face('+posInd+')')	
	const positions = geom.getAttribute( 'position' ), numFaces = positions.count/3;
	const p = positions.array;
	if(posInd >= positions.count) return;
	const faceInd = ~~(posInd/3), a=faceInd*3, b=a+1, c=a+2;	// ~~ это взятие целой части
	function _1(i) { return (' '+i+': '+p[3*i+0]+' '+p[3*i+1]+' '+p[3*i+2]); }
	// console.log('abc=',_1(a),_1(b),_1(c))
	const colors = geom.getAttribute( 'color' ).array;
	colors[3*a+0] = color.r; colors[3*a+1] = color.g; colors[3*a+2] = color.b;
	colors[3*b+0] = color.r; colors[3*b+1] = color.g; colors[3*b+2] = color.b;
	colors[3*c+0] = color.r; colors[3*c+1] = color.g; colors[3*c+2] = color.b;
	geom.attributes.color.needsUpdate = true; // сработало!
}
	
// возвращает кривизну вершины posInd - номер триплета в geom.positions
function vertex_curvature(ctx, posInd) {
	const ind = surfaceInd(ctx, posInd)
	return ind != -1 ? ctx.frame_k[ind] : 0.0;
}

// для данной точки возвращаем массив индексов, в который она встречается
function get_all_positions(geom, posInd) {
	const positions = geom.getAttribute( 'position' );
	const p = positions.array;
	let res = [];
	if(posInd < positions.count) {
		
		const x=p[3*posInd+0], y=p[3*posInd+1], z=p[3*posInd+2];
		let cnt = 0;
		for(let i=0; i<p.length/3; i++)
			if(p[3*i+0] == x && p[3*i+1] == y && p[3*i+2] == z)
				res.push(i);
	}

	// res.forEach(i => console.log(i+':', p[3*1+0],p[3*i+1],p[3*i+2]));
	return res;
}

function search_frame_with_map_ctx(ctx, X, Y, Z) {
    const lin = ctx.cube.IJK2lin(X, Y, Z);
    let ind = ctx.frameMapByLin.get(lin);
    return !ind ? -1 : ind;
}

// i - индекс точки (триплета) в geom.position
// возвращает индекс точки на исходной поверхности, то есть индекс по frame_i или frame_k 
// при неудаче возвращает -1
function surfaceInd(ctx, i) {
	const position = ctx.geom.getAttribute( 'position' );
    let p1 = [], p2=[];
    let x = position.array[3*i+0], y = position.array[3*i+1], z = position.array[3*i+2];
    // одно из чисел x, y или z является дробным, a остальные целые, например
    // 384, 200.5, 57 => это середина ребра между 384, 200, 57 и 384, 201, 57
    // обе вершины являются XYZ индексом по наддутому кубу и одна из них должна присутствовать 
    // в массиве гауссовых фреймов
    //
    if(x != Math.floor(x)) {
        p1 = [Math.floor(x), y, z];
        p2 = [Math.floor(x)+1, y, z];
    }
    else if(y != Math.floor(y)) {
        p1 = [x, Math.floor(y), z];
        p2 = [x, Math.floor(y)+1, z];
    }
    else if(z != Math.floor(z)) {
        p1 = [x, y, Math.floor(z)];
        p2 = [x, y, Math.floor(z)+1];
    }
    // это поиск фрейма через map
    const ind1 = search_frame_with_map_ctx(ctx, p1[0],p1[1],p1[2]);
    const ind2 = search_frame_with_map_ctx(ctx, p2[0],p2[1],p2[2]);
    return ind1 != -1 ? ind1 : ind2 != -1 ? ind2 : -1;
}

// дается вершина - индекс триплета в positions
// проверяются все грани в которые входит эта вершина (обычно 6) 
// и возвращаются вершины этих граней в которых кривизна отрицательна (слабое условие)
// либо вершины граней в которых все вершины отрицательны (сильное условие), то есть только синие грани
function wave_i(ctx, i) {
	let spot = get_all_positions(ctx.geom,i);
	let w = new Set();
	// console.log('spot',spot)
	spot.forEach( ind => {
		const faceInd = ~~(ind/3), a=faceInd*3, b=a+1, c=a+2;
		// console.log(ind,': f',faceInd,'[',a,',',b,',',c,']')
		const k1 = vertex_curvature(ctx,a), k2 = vertex_curvature(ctx,b), k3 = vertex_curvature(ctx,c)
		const good = k1 < 0 && k2 < 0 && k3 < 0;
		if(good) { w.add(a); w.add(b); w.add(c); }
	})

	// console.log('w',w)
	return w;
}

function color_i(ctx,i) {
	let w = wave_i(ctx,i)
	let cnt = 0;
	const color = new THREE.Color(0x00ff00);
	w.forEach( ind => color_face(ctx.geom,ind,color))
}

// a += b
function set_merge(a,b) {
	b.forEach(i => a.add(i))
}
// a -= b
function set_sub(a,b) {
	b.forEach(i => a.delete(i))
}
// идет волна пока не захлебнется
function wave(ctx,i,color) {
	let n = 0;	// ограничитель на число фронтов волны
	let ow = new Set(), nw= new Set(); nw.add(i);
	// const color = new THREE.Color(0x00ff00);
	while(n<20) {
		let nf = new Set();
		nw.forEach(ind => {
			let front = wave_i(ctx,ind)
			set_merge(nf,front);
		})
		// nf содержит новые голубые вершины
		// из них надо вычеркнуть уже обработанные
		set_sub(nf,ow)
		if(nf.size == 0) break;
		nf.forEach(ind => color_face(ctx.geom,ind,color));
		set_merge(ow,nf);
		nw = nf;
		n++;
	}
	console.log(' wave n=',n, 'ow.size=',ow.size)
}