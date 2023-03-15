/**
 * Класс FFR__protocol реализует транспортный уровень передачи по вебсокету и FFR-protocol как текстовый, так и двоичный
 * Текущий текстовый протокл представлен ниже:
 * ------------------------------------------
 * названия FFR методов капитализированы, как они названы в соответствующих процедурах ArterialThreeBuilder,
 * например, FFR_Initialize() с отбрасыванием префикса FFR_ или FFR_Process_
 *  isReady()
 *  version()
 *  Initialize()
 *  PrepareAortaProc(func)
 *  LoadAortaPreview() -> ArrayBuffer
 *  PrepareVesselsProc(params) -> "ok"
 *  testProgress()
 *  testDownstream()
 *
 *  Двоичный протокол представлен командой LOAD CUBE (binary in + binary stream - text stream out)
 *   FindAorta LoadAortaPreview LoadVesselsPreview LoadAortaObject LoadVesselsObject
 *   Это все примеры команд text in - binary out
 *   AortaSearch_FindAorta (1.2.4.70) для нового диалога Accept/Reject  -первый пример команды 
 *   binary in - binary out
 */

class FFR__protocol {

  /**
  * @param {!string} wsurl 						--URL WS сервера
  */
	constructor(wsurl) {
		let self = this;
		this._wsurl = wsurl;
		this._wsready = false;
		this._ws = new WebSocket(wsurl, "ffr-protocol");
		this._ws.onopen = function()  { self._wsready = true; }
		this._ws.onclose = function() { self._wsready = false; }
		this._ws.onerror = function() { self._wsready = false; }
        this.CMD = {
            LOAD_CUBE: 3,
            AortaSearch_FindAorta: 4,
            Initialize: 5,
            PrepareResult: 6,
        }

        this.cmdString = function(code) {
            const cmd = ['LOAD_CUBE', 'AortaSearch_FindAorta']
            return ( code >=3 && code<= 4 ? cmd[code-3] : 'unknown')
        }
	}

	addEventListener(event,func) {
		if(event === 'close') 
			this._ws.addEventListener('close',func);
		else if(event === 'ready')
			this._ws.addEventListener('open',func);
	}

	isReady() {return this._wsready;}

	sendRequest(req) {
		if(!this._wsready) return Promise.reject("no connection to server");
		let self = this;
        return new Promise(function (resolve, reject) {
        	self._ws.onmessage = (e) => resolve(e.data);
            self._ws.onerror = reject;
            console.log("sending on ffr-protocol: ",req)
            // WebSocket.binaryType = "blob" (default) | "arraybuffer"
            self._ws.binaryType = "blob";
            self._ws.send(req);
        });	
	}

    // async reqToString(req) {
    //     if(req instanceof Blob) {
    //         let res = await req.slice(0,2).arrayBuffer()
    //         const cmd = new Uint8Array(res)
    //         if(cmd[0] == 56)
    //             return `binary CMD ${cmd[1]} (${this.cmdString(cmd[1])})`
    //     }
    //     return req
    // }

    sendRequestReturningArrayBuffer(req) {
        if(!this._wsready) return Promise.reject("no connection to server");

        // это эксперименты с декодированием binary CMD -> string
        // работать то работает (если раскомментировать reqToString)
        // но GCC при компиляции очень сильно ругается поэтому ладно, пусть будет по старинке
        // console.log("sending on ffr-protocol: ", await this.reqToString(req)) 

        console.log("sending on ffr-protocol (binary): ", req)

        return new Promise( (resolve, reject) => {
            this._ws.onmessage = (e) => resolve(e.data);
            this._ws.onerror = reject;
            this._ws.binaryType = "arraybuffer";
            this._ws.send(req);
        }); 
    }

	sendRequestFSF(req) {
		if(!this._wsready) return Promise.reject("no connection to server");
		let self = this;
		let chunks = [];
        return new Promise(function (resolve, reject) {
        	self._ws.onmessage = function(e) {
                //console.log('_ws.onmessage', e.data)
        		if(!(e.data instanceof Blob))
        			resolve(e.data);
        		else {
	        		blobAsUint8Array(e.data).then(e=>{
                        //console.log('e',e)
	        			let parts = FSFparse(e);
	        			for(let i=0; i<parts.length; i++)
	    					chunks.push(parts[i].result);
	        			if(parts.length ==0 || parts[parts.length-1].fin) 
	        				resolve(chunks);
        			})
	        	}
        	}
            self._ws.onerror = reject;
            console.log("sending on ffr-protocol: ",req)
            self._ws.send(req);
        });	
	}

	version() { return this.sendRequest("version"); }
    // исторически это первая команда. В 1.2.4.70 заменена двоичной версией см. ниже
    // AortaSearch_FindAorta() { return this.sendRequestReturningArrayBuffer("AortaSearch_FindAorta"); }

    /**
     * Команда AortaSearch_FindAorta возвращает список кружков на указанном срезе.
     * Она нужна для поддержки нового диалога с Accept/Reject, когда пользователь может указать
     * альтернативный кружок. Для полноты в команде также присутствуют параметры число кружков
     * и минимальный и максимальный радиусы кружка, хотя их значения по умолчанию
     * предположительно подходят для большинства пациентов. На стороне сервера эти параметры игнорируются
     * 
     * since 1.2.4.70
     * 
     * @param {number=} numCircles  число кружков (default 2)
     * @param {number=} minRadius   минимальный радиус аорты (default 10)
     * @param {number=} maxRadius   максимальный радиус аорты (default 35)
     * @return {Array}  [{result:true} | {{result:false, code: number, reason:string},
     *                    Uint8Array --img data, Float64Array(4*n) - n*<center3D,radius> ]
     */
    AortaSearch_FindAorta(numCircles, minRadius, maxRadius) {
        numCircles = numCircles || 2
        minRadius  = minRadius  || 10
        maxRadius  = maxRadius  || 35

        let cmd = FSF.CMD(this.CMD.AortaSearch_FindAorta);

        // min и max радиусы по смыслу являются float, но в силу их приблизительности,
        // округление до int вполне допустимо, поэтому параметры передаются одним массивом
        //
        let params = FSF.Array(new Uint16Array([numCircles,minRadius,maxRadius]));
        let b2 = new Blob([cmd,params]);
        //return this.sendRequestFSF(b2); // sendRequestFSF надо вообще убрать
        console.log('sending on ffr-protocol: binary CMD AortaSearch_FindAorta')
        return this.sendRequestReturningArrayBuffer(b2);        
    }

    /**
     * Пустые параметры, переданные на сервер, означают использовать точку, которую нашла FindAorta
     * 
     * @pamam {number} x
     * @pamam {number} y
     * @pamam {number} z
     * @pamam {number} r
     * 
     * since 1.2.4.70
     */
    Initialize(x,y,z,r) {
        const data = (x === undefined ? [] : [x,y,z,r])
        let cmd = FSF.CMD(this.CMD.Initialize);
        let params = FSF.Array(new Float32Array(data)); //
        const args = new Blob([cmd, params])
        return this.sendRequestReturningArrayBuffer(args);
    }
	PrepareAortaProc(func) {
		if(!this._wsready) return Promise.reject("busy");
		let self = this;
        return new Promise(function (resolve, reject) {
            self._ws.send("PrepareAortaProc");
            self._ws.onmessage = function(e) {
            	if(e.data === 'fin') {
            		func('1 fin');		// 100%
            		resolve(e.data);
            	}
            	else 
            		func(e.data);
            }
            self._ws.onerror = reject;
        });			
	}
    // since 1.2.4.66
	GetOptimalTau() { return this.sendRequest("GetOptimalTau"); }
	LoadAortaPreview(tau) { return this.sendRequestReturningArrayBuffer('LoadAortaPreview '+tau); }

    /**
     * @param {!D10StateType} params
     */
	PrepareVesselsProc(params, func) {
		if(!this._wsready) return Promise.reject("busy");
		let self = this;
        return new Promise(function (resolve, reject) {
            let msg = 'PrepareVesselsProc '+params.tau+' '+params.alpha+' '+params.beta+' '+params.gamma;
            self._ws.send(msg);
            self._ws.onmessage = function(e) {
            	if(e.data === 'fin') {
            		func('1 fin');		// 100%
            		resolve(e.data);
            	}
            	else 
            		func(e.data);
            }
            self._ws.onerror = reject;
        });			
	}

	SetVesselsSeeds() { return this.sendRequest("SetVesselsSeeds"); }

	LoadVesselsPreview(threshold) { return this.sendRequestReturningArrayBuffer("LoadVesselsPreview "+threshold); }

	/** @param {!D10StateType} aortaParams
     *  @param {!number} vesselsThreshold
     */
    Thinning(aortaParams, vesselsThreshold, func) {
		if(!this._wsready) return Promise.reject("busy");
		let self = this;
        return new Promise(function (resolve, reject) {
            let msg = 'Thinning '+aortaParams.tau+' '+aortaParams.alpha+' '+aortaParams.beta+' '+aortaParams.gamma;
            msg += ' '+vesselsThreshold;
            console.log(msg)
            self._ws.send(msg);	// %f thinning...fin retcode
            self._ws.onmessage = function(e) {
            	if(e.data.startsWith('fin')) {
            		let part = e.data.split(' ');
            		let retCode = part.length > 1 ? parseInt(part[1],10) : 0;
            		func('1 fin');		// 100%
            		resolve(retCode);
            	}
            	else 
            		func(e.data);
            }
            self._ws.onerror = reject;
        });			
	}

    // since 1.2.4.69
    DeleteVessel(ind) { return this.sendRequest(`DeleteVessel ${ind}`); }
	LoadAortaObject() { return this.sendRequestReturningArrayBuffer("LoadAortaObject"); }
	GetVesselsObjectsCount() { return this.sendRequest("GetVesselsObjectsCount"); }
	GetVesselsCount() { return this.sendRequest("GetVesselsCount"); }
	LoadVesselsObject(ind) { return this.sendRequestReturningArrayBuffer("LoadVesselsObject " + ind); }
	GetVesselInfo(ind) { return this.sendRequest("GetVesselInfo " + ind); }
	GetVesselBifurcations(ind) { return this.sendRequest("GetVesselBifurcations " + ind); }
	GetVesselCenterLine(ind) { return this.sendRequest("GetVesselCenterLine " + ind); }
	PrepareResult(sList, func) {
		console.log('get PrepareResult()')		
		if(!this._wsready) return Promise.reject("busy");
		let self = this;
        return new Promise(function (resolve, reject) {
            let msg = 'PrepareResult ';
            for(let st of sList) {
                msg += ` ${st.frontPos.x} ${st.frontPos.y} ${st.frontPos.z}`
                msg += ` ${st.rearPos.x} ${st.rearPos.y} ${st.rearPos.z} ${st.UserStenosisPercent}\n`
            }
            console.log(msg);
            self._ws.send(msg);	// %f thinning...fin retcode
            self._ws.onmessage = function(e) {
                // ответ может быть либо 1) "%f" 2) fin %f" либо 3) "fin error %d"
                // 1) процесс расчета продолжается %f показывает примерный процент выполнения
                // 2) процесс расчета завершился и %f показывает величину ФРК
                // 3) процесс расчета завершился аварийно с кодом ошибки %d
            	if(e.data.startsWith('fin')) {
            		let part = e.data.split(' ');
            		let retCode = part.length == 2 ? parseFloat(part[1]) : ''+part[1]+' '+part[2];
            		func('1 fin');		// 100%
            		resolve(retCode);
            	}
            	else 
            		func(e.data);
            }
            self._ws.onerror = reject;
        });			
	}

    PrepareResultBinary(sList, patientData, func) {
        console.log('PrepareResultBinary()')
        if(!this._wsready) return Promise.reject("busy");
        let self = this;
        return new Promise(function (resolve, reject) {
            let stData = [];
            for(let st of sList) {
                stData.push( st.frontPos.x, st.frontPos.y, st.frontPos.z )
                stData.push( st.rearPos.x, st.rearPos.y, st.rearPos.z, st.UserStenosisPercent)
            }

            let cmd = FSF.CMD(self.CMD.PrepareResult);
            let fsf_p1 = FSF.Float32Array(stData);
            let fsf_p2 = FSF.Float32Array(patientData);

            // предполагается, что эти данные не фрагментируются вебсокером
            let b2 = new Blob([cmd, fsf_p1,fsf_p2]);
            self._ws.send(b2);
            self._ws.onmessage = function(e) {
                // ответ может быть либо 1) "%f" 2) fin %f" либо 3) "fin error %d"
                // 1) процесс расчета продолжается %f показывает примерный процент выполнения
                // 2) процесс расчета завершился и %f показывает величину ФРК
                // 3) процесс расчета завершился аварийно с кодом ошибки %d
                if(e.data.startsWith('fin')) {
                    let part = e.data.split(' ');
                    let retCode = part.length == 2 ? parseFloat(part[1]) : ''+part[1]+' '+part[2];
                    func('1 fin');      // 100%
                    resolve(retCode);
                }
                else
                    func(e.data);
            }
            self._ws.onerror = reject;
        });
    }

	// эта функция имитирует такой сценарий send "test progress" <- %f text.. %f text ..fin
	testProgress(func) {
		if(!this._wsready) return Promise.reject("busy");
		let self = this;
        return new Promise(function (resolve, reject) {
            self._ws.send("test progress");
            self._ws.onmessage = function(e) {
            	//console.log('_ws.onmessage:test progress',e);
            	if(e.data === 'fin') {
            		func('1 fin');		// 100%
            		resolve(e.data);
            	}
            	else 
            		func(e.data);
            }
            self._ws.onerror = reject;
        });			
	}

	// эта функция имитирует загрузку большого массива двоичных данных по вебсокету
	testDownstream() { return this.sendRequest("test downstream"); }
    testBinary() {return this.sendRequest("test binary");}

    //=========================================================================
    // Это команды FFR-binary протокола
    //=========================================================================

    // TRANSFER CUBE p0 = UID(SHA-256)[32] p1=ijk2LPS[16] p2=lps2IJK[16] p3=spacing[3] cube<type>[][][]
    //
    // Передача куба происходит в два этапа: сначала передается команда и параметры, которые помещаются в один фрейм вебсокета,
    // а затем передаются фреймы стека DICOM, которые при передаче могут быть фрагметированы протоколом websocket
    // и собираются сервером ATB. Поэтому последним параметром команды передается дескриптор FSF без данных, из которого 
    // сервер может понять, какого типа воксели в кубе DICOM и какова его размерность. Такая передача обеспечивает минимально
    // возможную перепись данных в памяти как на передающей, так и на приемной стороне, что существенно, учитывая большой
    // объем передаваемых данных. Сами данныые по вебсокету передаются подозрительно быстро - на локальной машине 59 Мб за секунду,
    // а на додо 59 Мб передаются за 11 секунд. При этом проверка данных на контрольную сумму и min/max прошла успешно.
    // Пока команда не возвращает статус выполнения. Из-за высокой скорости передачи я также не стал вводить индикацию прогресса. 
    // 
    // Передаваемый параметр UID будет вычисляться как SHA-256 хэш UID'ов фреймов, входящих в DICOM. Тем самым можно будет уникально
    // и однозначно идентифицировать передаваемые данные и кешировать их на сервере, включая прореженные серии. Одновременно этим 
    // решается вопрос анонимизации данных. На сервер не будут передаваться никакие персональные данные. 
    //
    // Тип передаваемого куба может быть любым, [u]int<8,16,32> float32 или float64. Передача 64-рр целых не поддерживается,
    // а также 128 разрядных чисел с плавающей точкой.
    //
    // 06.07.2021 Пример Колмыкова (Томск) показывает, что  возможно 
    // преобразовние величин вокселей, хранящихся в DICOM (SV - Stored Values) в Houndsfield Unit HU. У Колмыкова SV отличается
    // от HU на -1024, а это приводит к тому, что преобразование Хафа неправильно определяет срез аорты. Сам стек будет хранить
    // SV - так устроен AMI и фактический перевод SV в HU происходит в паре мест в helpers.slice.js и models.frame.js. Однако
    // передавать куб надо в HU, а это означает, что иногда данные фрейма надо будет пересчитывать при передаче, учитывая 
    // величины (0028,1052) Rescale Intercept и (0028,1053) Rescale Slope по формуле U = m*SV + b как описано по ссылке
    // https://blog.kitware.com/dicom-rescale-intercept-rescale-slope-and-itk/
    // При этом пересчет будет происходить только, если Rescale Intercept и Rescale Slope присутствуют и отличаются от default
    // значений. Более тонкие моменты Bits Allocated (0028|0100), Bits Stored (0028|0101), Pixel Representation (0028|0103), 
    // and Sample per Pixel (0028,0002) учитываться не будут. При возникновении пересчета SV -> HU, придется заводить новый 
    // массив в памяти, то есть эффективность передачи снижается, но здесь ничего не сделать. У Почукаевой, например, никакого
    // пересчета делать не надо и фреймы будут передаваться прямо из стека.
    // Интересно отметить пару вещей. В ссылке выше сказано, что баг с Rescale Intercept и Slope был поправлен в ITK 4.6, то есть
    // разработчики годами жили с этим багом. И еще интересно выяснить почему преобразование Хафа так чувствительно к величинам
    // интенсивностей.
    // К слову, у Почукаевой Rescale Intercept, Rescale Slope и Rescale Type (0028,1054) отсутствуют, что означает что величины,
    // хранимые в DICOM и есть Houndsfield Unit HU. Возможно, это наиболее распространенный случай.
    // 
	TransferCube(stack,func) {
        // console.log('TransferCube()')
        if(!this._wsready) return Promise.reject("no connection to server");
        let self = this;

        const slope = stack['rescaleSlope'], intercept = stack['rescaleIntercept'];
        const needSlopeInterceptCalc = (slope != 1 || intercept != 0);
        // console.log('slope/intercept/needSlopeInterceptCalc',slope,intercept,needSlopeInterceptCalc)

        return new Promise(function (resolve, reject) {
            self._ws.onmessage = (e) => resolve(e.data);
            self._ws.onerror = reject;
            console.log("sending on ffr-protocol: binary CMD LOAD CUBE")

            let cmd = FSF.CMD(self.CMD.LOAD_CUBE);
            let cube_UID = new Uint8Array(32); cube_UID[0] = 255;   // TBD: вычислить sha-256 хэш
            let fsf_p0 = FSF.Array(cube_UID);
            let fsf_p1 = FSF.Float32Array(stack.ijk2LPS.elements);
            let fsf_p2 = FSF.Float32Array(stack.lps2IJK.elements);
            let fsf_p3 = FSF.Float32Array([stack._spacing.x, stack._spacing.y, stack._spacing.z]);

            let stack_dims = [stack.dimensionsIJK.x, stack.dimensionsIJK.y, stack.dimensionsIJK.z];
            let fsd_dicom = FSF.D(stack.frame[0]['pixelData'],stack_dims);

            // предполагается, что эти данные не фрагментируются вебсокером
            let b2 = new Blob([cmd,fsf_p0, fsf_p1,fsf_p2,fsf_p3,fsd_dicom]);
            self._ws.send(b2);
            self._ws.onmessage = function(e) {
                //console.log('_ws.onmessage:test progress',e);
                if(e.data === 'fin') {
                    func('1 fin');      // 100%
                    resolve(e.data);
                }
                else 
                    func(e.data);
            }
            // передача фреймов стека DICOM может быть фрагментирована вебсокетом
            for(var z=0; z<stack_dims[2]; z++) {
                let data = stack.frame[z]['pixelData']; // Int16Array
                if(needSlopeInterceptCalc) {
                    let copyData = data.slice();
                    for(let i=0; i<data.length; i++)
                        copyData[i] = slope * data[i] + intercept;
                    data = copyData;
                }
                self._ws.send(data);
            }
        }); 
	}    
}

