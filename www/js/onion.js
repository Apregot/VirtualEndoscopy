class Onion {

    /**
     * Класс для определения профиля радиуса сосудов для автоматическои маркировки стеноза 
     * @param {*} state state={stack,aortaCube,vessels:[v0Cube,v1Cube], vesselInfo:[{name,burificationPoints,centerline{Float64Array}}]}
     */
	constructor(state) {
		//console.log('конструктор Onion');
		this._state = state;
	}

    /**
     * построение профиля сосуда
     * @param {Number} vesselInd индекс сосуда
     */ 
    vesselProfile(vesselInd) {
        //console.log(`Onion::vasselProfile(${vesselInd})`);
        // let onion = [   // spacing=[0405,0.405,1]
        //     {dist:0.405, vv:new Set([[-1,0,0],[1,0,0],[0,1,0],[0,-1,0]]), bw:null},
        //     {dist:0.405*1.41, vv:new Set([[1,1,0],[1,-1,0],[-1,-1,0], [-1,1,0]]), bw:null},
        // ];
        let onion = this.makeOnion([3,3,3]);
        const cube = this._state.vesselInfo[vesselInd].artery.cube;// console.log('cube',cube)

        function dist(center,onion) {
            for(let s=onion.length-1; s>=0; s--) {
                // s-я оболочка
                let zCnt=0, nonZeroCnt=0;
                for (let v of onion[s].vv) {
                    let val = cube.getValue(center.x+v[0], center.y+v[1], center.z+v[2]);
                    if(val == 0) zCnt++; else nonZeroCnt++;
                }
                onion[s].bw = [zCnt, nonZeroCnt];   // black-white bw[0] - zero count, bw[1] - nonzero count
            }

            //console.log(`[${center.x},${center.y},${center.z}] = `)
            for(let s=0; s<onion.length; s++)
                console.log(onion[s].bw)
            //return undefined;
        }

        const name = this._state.vesselInfo[vesselInd].name, centerline = this._state.vesselInfo[vesselInd].centerline
        const nPts = centerline.length/3;

        let profile = [], path = []
        const t0 = performance.now();

        for(let i=0; i<nPts-1; i++) {
            let v = new THREE.Vector3(centerline[3*i], centerline[3*i+1], centerline[3*i+2]);
            let ijk = AMI.UtilsCore.worldToData(this._state.stack.lps2IJK, v); //console.log('IJK=');console.log(ijk);
            //this.getRadius(ijk,onion,this._state.vessels[1]); //dist(ijk,onion);
            let rad = this.getRadiusSimplified(ijk,cube); //console.log('rad',rad)
            profile.push(rad)
            path.push(ijk)
       }
       //console.log('time elapsed', performance.now()-t0)  

       // console.table(profile)
       //console.table(path)
       return profile;
    }

    // center - это ijk как Vector3; vesselMask это куб с маской сосуда
    getRadius(center, onion, vesselMask) {
    	// строим профиль слоев луковицы
    	let onionProfile = [];		// здесь будут записаны профиль всех слоев 

	    for(let s=0; s<onion.length; s++) {
	        // s-я оболочка
	        let zCnt=0, nonZeroCnt=0;
	        for (let v of onion[s].vv) {
	            let val = vesselMask.getValue(center.x+v[0], center.y+v[1], center.z+v[2]);
	            if(val == 0) zCnt++; else nonZeroCnt++;
	        }
	        onionProfile.push([zCnt, nonZeroCnt]);
	    }
	    console.log(`getRadius([${center.x},${center.y},${center.z},]) profile`, onionProfile)
    }

    // получается, что никакая луковица не нужна
    // пожно просто пройтись вокруг центра по кубику NxMxK
    // и найти ближайшую точку касания
    //
    getRadiusSimplified(center, vesselMask) {
    	const spacing = this._state.stack._spacing;
    	const dims = [7,7,3], N=(dims[0]-1)/2, M=(dims[1]-1)/2, K=(dims[2]-1)/2;
    	let d2Min = undefined, d2MinPoint = [], d2Max = undefined
    	for(let i=-N; i<=N; i++) {
    		for(let j=-M; j<=M; j++)
    			for(let k=-K; k<=K; k++) {
    				if(i == 0 && j == 0 && k == 0) continue;	// выколотый центр
    				const dx = i*spacing.x, dy = j*spacing.y, dz = k*spacing.z;
    				let d2 = dx*dx + dy*dy + dz*dz;
    				if(d2Max == undefined || d2 > d2Max) d2Max = d2;
    				if(vesselMask.getValue(center.x+i,center.y+j,center.z+k) == 0) {
	    				const dx = i*spacing.x, dy = j*spacing.y, dz = k*spacing.z;
	    				let d2 = dx*dx + dy*dy + dz*dz;
	    				if(d2Min == undefined || d2 < d2Min) {
	    					d2Min = d2;
	    					d2MinPoint = [i,j,k]
	    				}
    				}
    			}
    	}
    	//if(d2Min != undefined) console.log('d2MinPoint',d2MinPoint, d2Min, spacing, 0.405*0.405)
    	return d2Min == undefined ? Math.sqrt(d2Max) : Math.sqrt(d2Min);
    }

    test() {
		let onion = this.makeOnion([3,3,3]);  	
        let vesselInd = 5;
        const name = this._state.vesselInfo[vesselInd].name, centerline = this._state.vesselInfo[vesselInd].centerline
        const nPts = centerline.length/3, i=1;
        let v = new THREE.Vector3(centerline[3*i], centerline[3*i+1], centerline[3*i+2]);
        let ijk = AMI.UtilsCore.worldToData(this._state.stack.lps2IJK, v); //console.log('IJK=');console.log(ijk);
        this.getRadius(ijk,onion);
    }

    // spacing берется из stack
    makeOnion(dims) {
    	// console.log('makeOnion spacing', this._state.stack._spacing)
    	// assert: все размеры нечетные >=3
    	const spacing = this._state.stack._spacing;
    	const N=(dims[0]-1)/2, M=(dims[1]-1)/2, K=(dims[2]-1)/2;
    	// onion layers: массив объектов {dist,vv:Set([i,j,k])}
    	let dist = [], points = [];
    	for(let i=-N; i<=N; i++) {
    		for(let j=-M; j<=M; j++)
    			for(let k=-K; k<=K; k++) {
    				const dx = i*spacing.x, dy = j*spacing.y, dz = k*spacing.z;
    				let d2 = dx*dx + dy*dy + dz*dz;
    				if(d2 == 0) continue;	// выколотый центр
    				// TBD: убрать угловые точки куба

    				// ищем слот для d2
    				let ind = dist.indexOf(d2);
    				if(ind == -1) {
    					// создаем новый слой
    					// (1) либо добавляем в конец 					
    					if(dist.length == 0 || d2 > dist[dist.length-1]) {    						
    						dist.push(d2);
    						points.push([]);
    						ind = dist.length-1;
    					}
    					// (2) либо вставляем в середину: массив dist всегда упорядочен по возрастанию
    					else {
    						// условие (1) гарантирует, что в массиве есть элемент > d2
    						let ii = 0;
    						while(dist[ii] < d2)
    							ii++;
    						// вставка в позицию ii
    						dist.splice(ii,0,d2);
    						points.splice(ii,0,[]);
    						ind = ii;
    					}
    				}

    				// добавляем точку [i,j,k] в слой
    				points[ind].push([i,j,k]);
    			}
    	}

    	// все точки обработаны
    	for(let i=0; i<dist.length; i++)
    		dist[i] = parseFloat(Math.sqrt(dist[i]).toFixed(3));

    	// console.log('dist',dist)
    	// console.log('points',points)

    	let onion = [];
    	for(let i=0; i<dist.length; i++)
    		onion.push({dist:dist[i], vv:points[i]});

    	// console.log('makeOnion ',onion)
    	return onion;
    }	
}

const N6 = {
	// Number.MAX_SAFE_INTEGER (2^53 - 1)

	N6: new Set([{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}]),

	distance: function (v1,v2) {
		return Math.abs(v2.x - v1.x) + Math.abs(v2.y - v1.y) + Math.abs(v2.z - v1.z);
	},

	/**
	 * @param {!Object} center 	{x,y,z}
	 * @param {Set} surface точки поверхности
	 * @return {Set} поддутая на 1 шаг поверхность
	 */
	inflateSurface: function (center, surface) {
		let inflatedSurface = new Set();
		const distToSurface = surface.size ? N6.distance(center,surface.values().next().value) : 0;
		for (let v of surface) {
			let sv = N6.inflateVertex(v)
				for (let vv of sv)
					if(N6.distance(center,vv) > distToSurface)
						inflatedSurface.add(vv)
		}
		return inflatedSurface
	},

	/*
	 * @return {Set} поддутая на 1 шаг по N6 точка
	 */
	inflateVertex: function (v) {
		let s = new Set();
		for (let p of N6.N6) 
			s.add({x:v.x+p.x, y:v.y+p.y, z:v.z+p.z})
		return s;
	}
}