goog.require('goog.events.Event');

// Собрание регрессионных тестов для ФРК

const RGT = {


    /** 
     * Диспетчер событий приходящий из подменю 'Регрессионные тесты'
     * @param {goog.events.Event} e 
     */
	processEvent: function(e) {
		const cap = e.target.getCaption()
		// console.log(`RGT.processEvent(${cap})`)
		if(cap === 'Почукаева-113')				RGT.Pochukaeva_113()			
		else if(cap === 'debug test')			RGT.testDebug()
	},

    Pochukaeva_113: async function()    {
        console.log('Автоматический тест Почукаева-113')
		const _FFRsrv = FFR.viewer._FFRsrv
        const files = ['http://localhost/~germank/IM1']
        let loader = new AMI.VolumeLoader(/*container, CustomProgressBar*/);
        console.log(`загружаем DICOM ${files[0]}`)
        await loader.load(files)
        
        let series = loader.data[0].mergeSeries(loader.data)[0];
        console.log('прореживаем серию до 200 срезов' )
        let thinSeries = FFR.viewer.seriesLists.seriesThinOut(series,200);    // до 200 срезов
        //_seriesFingerprint(thinSeries); return
        console.log('добавляем серию в список и загружаем в QuadView' )
        FFR.viewer.seriesLists.addNewSeries(thinSeries);
        FFR.viewer._quadview.loadSeries(thinSeries);

        // Это шаг ffrdriver.start()
        // ffrsrv.TransferCube
        // ffrsrv.AortaSearch_FindAorta()
        // Dialog8 чтобы изобразить кружок аорты и получить Accespt (пропускаем)
        // ffrsrv.Initialize()
        // ffrsrv.GetOptimalTau()
        // ffrsrv.PrepareVesselsProc({optimal_tau,0.5,0.5,500})

        console.log('передаем куб' )
        const stack = thinSeries.stack[0]
        let ret_cube = await _FFRsrv.TransferCube(stack, e => console.log('.'));
        console.log('AortaSearch' )
        await _FFRsrv.AortaSearch_FindAorta()
        await _FFRsrv.Initialize();       // ответ только ok
        console.log('PrepareAortaProc' )
        await _FFRsrv.PrepareAortaProc(e => console.log(e));
        console.log('GetOptimalTau' )
        let aortaPreviewState = /** @type {D10StateType} */({tau:0.09, alpha:0.5, beta:0.5, gamma:500, mesh:null});
        let optimal_tau = await _FFRsrv.GetOptimalTau();
        console.log(optimal_tau)
        if (optimal_tau > 0.0)
            aortaPreviewState.tau = optimal_tau;
        aortaPreviewState.tau = 0.09
        let data = await _FFRsrv.LoadAortaPreview(aortaPreviewState.tau);

        // на предыдущем этапе пользователь получил оптимальное tau превью аорты при этом tau
        // Он мог подвигать тау туда сюда и изменить альфа/бета/гамма
        // Начинается Шаг 3
        // PrepareVesselsProc с выбранными тау/альфа/бета/гамма
        // ffrsrv.LoadAortaObject()
        // в драйвере вызывается диалог-11, который меняет порог 20 и подгружает новые сосуды,
        // чтобы пользователь посмотрел как они выглядят вместе с аортой
        // результат работы шага 3  - выбор порога vesselsThreshold (по умолчанию 20)


        let t0 = performance.now();
        console.log('calling PrepareVesselsProc')
        await _FFRsrv.PrepareVesselsProc(aortaPreviewState, e => console.log(e))
        console.log('PrepareVesselsProc returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');

        t0 = performance.now();
        let aortaObj = await _FFRsrv.LoadAortaObject();
        console.log('LoadAortaObject returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');
        let obj = FSF.parseBuffer(aortaObj); //console.log('obj',obj);
        let aortaCube = new Cube(obj[0],'aorta');
        aortaCube.nonzerostats(true);
        // let aortaGeometry = aortaCube.geometry();
        // var aortaMesh = new THREE.Mesh(aortaGeometry, new THREE.MeshLambertMaterial( { color: 0x00fafa, side: THREE.DoubleSide }));

        // шаг 4:  Thinning({тау/альфа/бета/гамма},vesselsThreshold) 
        // ffrsrv.LoadAortaObject() --интересно, а почему снова загружается аорта?
        // ffrsrv.LoadVesselsObject --все потроха сосудов

        t0 = performance.now();
        const vesselsThreshold = 20
        let retcode = await _FFRsrv.Thinning(aortaPreviewState, vesselsThreshold,  e => console.log('.'));
        console.log('Thinning returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');

        // это повторная загрузка аорты после Thinning
        // по zerostat эта та же самая аорта
        t0 = performance.now();
        aortaObj = await _FFRsrv.LoadAortaObject();
        console.log('LoadAortaObject returns in', ((performance.now()-t0)/1000).toFixed(3),'сек');
        obj = FSF.parseBuffer(aortaObj); //console.log('obj',obj);
        aortaCube = new Cube(obj[0],'aorta');
        aortaCube.nonzerostats(true);

        let vesselObjectsCount = await _FFRsrv.GetVesselsObjectsCount();
        let vesselCube = [];
        for(let i=0; i<vesselObjectsCount; i++) {
            let vesselData = await _FFRsrv.LoadVesselsObject(i);
            let obj = FSF.parseBuffer(vesselData);
            vesselCube.push(new Cube(obj[0],'vessel'+i));
        }
        // this - это FFR__driver а кто его создает? QuadView.initializeFFRProcessing()
        console.log('Запрашиваем vessel info')
        let _ffrDriver = new FFR__driver(_FFRsrv, thinSeries); 
        let v = await _ffrDriver.getVesselInfo()
        console.log('v=',v)

        console.log('calling processMarkStenosis');
        let state4Obj = {stack:stack, aortaCube:aortaCube, vessels: vesselCube, vesselInfo: v};
        FFR.viewer.processMarkStenosis(state4Obj)

        const vesselName = 'Right vessel: 3', range = [55,61]
        const vesselInd = FFR.viewer.markStenosisComponent._setSelectedVessel(vesselName)
        const vessel = FFR.viewer.markStenosisComponent._state.vesselInfo[vesselInd]
        console.log(`сосуд для маркировки "${vesselName}"[${range[0]},${range[1]}]`)

        FFR.viewer.vesselHistogramComponent._addTube(vessel, range);
        FFR.viewer.vesselHistogramComponent.buildHistogram(vessel)
        FFR.viewer.markStenosisComponent._buttonHandler__CaptureStenosis();

        //console.log('_stenosisList',FFR.viewer.markStenosisComponent._state._stenosisList)
        FFR.viewer.markStenosisComponent._state._stenosisList[0].UserStenosisPercent = 50;


        //FFR.viewer.markStenosisComponent._buttonHandler__StartCalculation();
	    let sList = [];
	    for(let st of FFR.viewer.markStenosisComponent._state._stenosisList) {
	        const front = _v(st.vessel.centerline,st.tube.range[0])
	        const rear  = _v(st.vessel.centerline,st.tube.range[1])
	        sList.push({frontPos:front, rearPos:rear, UserStenosisPercent:st.UserStenosisPercent})
	    }
	    t0 = performance.now();
	    console.log ('prepareStenosisResult() список стенозов', sList);

	    //const value = await _FFRsrv.PrepareResult(sList, e => console.log('.'));
        const value = await _FFRsrv.PrepareResultBinary(sList, [120,80,60,60], e => console.log('.'));
	    

	    const durationSec = (performance.now() - t0) / 1000;
	    const qmin = Math.floor(durationSec/60), qsec = Math.floor(durationSec % 60);
	    const durationStr = ''+qmin+' мин '+ qsec + ' сек';
	    let msg;

	    if(typeof value === 'string') {
	        msg = 'расчет завершился аварийно:   '+ value;
	    }
	    else {
	        msg = 'FFR value '+ value;
	        msg += '\n'+'Время выполнения: '+ durationStr;
	        alert(msg);
	        new PlasticBoy(	FFR.viewer.markStenosisComponent._state, 
	        				FFR.viewer.markStenosisComponent.visArea).colorTubesByFFR()
	    }
    },  

    testDebug: async function() {
        const _FFRsrv = FFR.viewer._FFRsrv
        const files = ['http://localhost/~germank/IM1']

        console.time('testDebug')
        
        let loader = new AMI.VolumeLoader(/*container, CustomProgressBar*/);
        console.log(`загружаем DICOM ${files[0]}`)
        await loader.load(files)
        let series = loader.data[0].mergeSeries(loader.data)[0];
        console.log('прореживаем серию до 200 срезов' )
        let thinSeries = FFR.viewer.seriesLists.seriesThinOut(series,200);    // до 200 срезов
        //_seriesFingerprint(thinSeries); return
        console.log('добавляем серию в список и загружаем в QuadView' )
        FFR.viewer.seriesLists.addNewSeries(thinSeries);
        FFR.viewer._quadview.loadSeries(thinSeries);       

        console.timeEnd('testDebug')

        // имитация Initialize FFR processing
        new FFR__driver(_FFRsrv,thinSeries).start();
        // await _FFRsrv.TransferCube(thinSeries.stack[0], e => console.log('.'));
        // await _FFRsrv.AortaSearch_FindAorta();
        // let ret = await _FFRsrv.Initialize(); console.log(ret)
    },

    // Это автомат для LoadState4 
    //
    testLoadState4: async function() {
    	console.log('RGT.testDebug()')    	
		const _FFRsrv = FFR.viewer._FFRsrv
        const files = ['http://localhost/~germank/IM1']
        let loader = new AMI.VolumeLoader(/*container, CustomProgressBar*/);
        console.log(`загружаем DICOM ${files[0]}`)
        await loader.load(files)
	    let series = loader.data[0].mergeSeries(loader.data)[0];
	    console.log('прореживаем серию до 200 срезов' )
	    let thinSeries = FFR.viewer.seriesLists.seriesThinOut(series,200);    // до 200 срезов
	    //_seriesFingerprint(thinSeries); return
	    console.log('добавляем серию в список и загружаем в QuadView' )
	    FFR.viewer.seriesLists.addNewSeries(thinSeries);
	    FFR.viewer._quadview.loadSeries(thinSeries);

	    console.log('загружаем state4' )
        let state4 = await _FFRsrv.sendRequestFSF("test load state4");
        console.log('распаковываем аорту и сосуды')
        let aortaCube = new Cube(state4[0],'aorta'), 
            v0Cube = new Cube(state4[1],'vessel0'), 
            v1Cube = new Cube(state4[2],'vessel1');

        // почему-то в конце state4 находится null, поэтому length-1
        const vesselsCnt = (state4.length-1)/3 - 1;
        //console.log(`число сосудов в state4 ${vesselsCnt}`)
        let vesselInfo = [];
        for(var i=1; i<=vesselsCnt; i++) {
            vesselInfo.push({name:state4[3*i], burificationPoints:state4[3*i+1].data, centerline:state4[3*i+2].data})
        }

        aortaCube.compress(); v0Cube.compress(); v1Cube.compress();      
        let state4Obj={stack:thinSeries.stack[0], 
            aortaCube:aortaCube, 
            vessels: [v0Cube,v1Cube], 
            vesselInfo: vesselInfo,
        };

        FFR.viewer.processMarkStenosis(state4Obj)

  }


};