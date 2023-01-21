class AxplaneControls extends THREE.EventDispatcher {
	constructor(camera, domElement, centerline) {
	  super();
	  // console.log('AxplaneControls()')
	  this.camera = camera;
	  this.camera["far"] = 10; this.camera["fov"] = 30;	// это от фонаря. Надо как то учитывать геометрию сосуда
	  this.domElement = domElement;
	  this.centerline = centerline;
	  this.maxInd = centerline.length/3 -1;
	  this.ptInd  = Math.floor(this.maxInd / 2);	// камеру помещаем в середину центральной линии	  
    this._axplane = this.makeAxplane();
	  this.next();
	  // document.addEventListener('keydown', e => this.onKeyDown(e), false);
	}
  get position() { return this.axplane.position.clone(); /*this.camera.position.clone()*/ }    
  set position(pos) { console.log('AxplaneControls::set position()', ' its a read only attribute.. ignoring') }  

  /** @param {number} frac    Установить относительную позицию по центральной линии [0,100]*/
  setRelativePosition(frac)  {
    if(frac < 0) frac = 0;
    if(frac > 100) frac = 100;
    // для простоты высчитываем не длину, а номер индекса
    this.ptInd = Math.floor(this.maxInd * frac/100) - 1;
    this.next();
  }

  /** @param {number} ptInd    Установить позицию по центральной линии на точку с индексом ptInd*/
  setAbsolutePosition(ptInd)  {
    if(ptInd < 0) ptInd = 0;
    if(ptInd > this.maxInd) ptInd = this.maxInd;
    this.ptInd = ptInd - 1;
    this.next();
  }

  // создает Axplane и помещает ее в текущую точку
  //
  makeAxplane()   { 
      let p0 = this.point(this.ptInd), p1 = this.point(this.ptInd+1);
      if(p0.equals(p1)) p1 = this.point(this.ptInd-1);
      let normal = new THREE.Vector3().subVectors(p1,p0); 
      normal.normalize(); //console.log('normal normalized',normal)
      let axplane = new Axplane();
      axplane.setPositionAndNormal(p0,normal);
      return axplane;
  }

	next() {
		// текущая точка центральной линии this.ptInd Передвигаемся на следующую держа как цель +2 точки
		// вообще то надо просвет сосуда держать как цель, только вот как его вычислить?
		let ptNext = this.point(this.ptInd+1), target = this.point(this.ptInd+3);
		if(ptNext.equals(target))	target = this.point(0);		// а куда еще нацелиться?
		this.camera.position.copy(ptNext);
		this.camera.lookAt(target);
    if(this._axplane) {
      const normal = new THREE.Vector3().subVectors(target,ptNext).normalize(); 
      this._axplane.setPositionAndNormal(ptNext,normal);
    }
		if(this.ptInd < this.maxInd) this.ptInd++;
    this.dispatchEvent({type: 'change'});
	}

  get axplane() { return this._axplane }

	prev() {
		let ptPrev = this.point(this.ptInd-1), target = this.point(this.ptInd-3);
		if(ptPrev.equals(target))	target = this.point(this.maxInd);		// а куда еще нацелиться?
		this.camera.position.copy(ptPrev);
		this.camera.lookAt(target);
    if(this._axplane) {
      const normal = new THREE.Vector3().subVectors(target,ptPrev).normalize(); 
      this._axplane.setPositionAndNormal(ptPrev,normal);
    }
		if(this.ptInd > 0) this.ptInd--;
    this.dispatchEvent({type: 'change'});
	}

	onKeyDown(e) {
		// console.log('AxplaneControls::onKeyDown() e.keyCode, e.code, e.ctrlKey, e.shiftKey=',e.keyCode, e.code, e.ctrlKey, e.shiftKey)
		if(e.code == 'KeyZ')
			this.camera.zoom *= (e.ctrlKey ? 0.5 : 2);
		else if(e.code == 'KeyT') {
			let target = this.camera.position;
			// здесь идея была нацелить TrackballControls на новую цель, надо проверить
		} else if(e.code == 'ArrowRight') {	this.next();
		} else if(e.code == 'ArrowLeft') {	this.prev();
		}
	}

	point(ind) { 
		return 	ind > this.maxInd 	? 	new THREE.Vector3().fromArray(this.centerline,this.maxInd*3) 	:
				ind < 0		 		?	new THREE.Vector3().fromArray(this.centerline,0) 			
				: 						new THREE.Vector3().fromArray(this.centerline,ind*3); 
		}	

	dispose() { 
		console.log('AxplaneControls::dispose()') 
		// document.removeEventListener('keydown', this.onKeyDown);		// listener - лямбда функция, ее не удалишь
	}		
	
	update() { this.camera.updateProjectionMatrix() }

  printInfo(target) {
    // camera: p0 target=lookAt axplane: position, normal
    let p0 = this.point(this.ptInd), t0 = new THREE.Vector3().subVectors(target,p0).normalize(); 
    console.log('camera: pos',p0,'target ',target, 't-norm',t0);
    if(this._axplane)
      console.log('axplane pos',this._axplane.position,' normal', this._axplane.normal)
  }
};

/*
      document.addEventListener("keydown", onDocumentKeyDown, false);
      function onDocumentKeyDown(event) {
          var keyCode = event.which;
          let camera = self.r4.camera;
          function pt(ind) { 
            if(ind >= self.positions.length/3)  ind = self.positions.length/3 - 1;
            if(ind < 0) ind = 0;
            return new THREE.Vector3(self.positions[3*ind],self.positions[3*ind+1],self.positions[3*ind+2]);
          }
          let p0 = pt(0), pCur = pt(self.ind), pNext = pt(self.ind+1), pLast = pt(self.positions.length-1);
          let pNextNext = pt(self.ind+2), pPrev = pt(self.ind-1);
          // console.log('onDocumentKeyDown', keyCode)
          // up 38 down 40 left 37 right 39
          if (keyCode == 37) {              // left
              camera.position.copy(pPrev);
              if(self.ind > 0) self.ind--;
              pLast = pNextNext;
              camera.lookAt(pLast.x,pLast.y, pLast.z);
              // down
          } else if (keyCode == 38) {       // up
            camera.zoom /= 2;
            camera.updateProjectionMatrix();                        
          } else if (keyCode == 40) {       // down
            camera.zoom *= 2;
            camera.updateProjectionMatrix();                        
          } else if (keyCode == 39) {       // right
              camera.position.copy(pNext);
              if(self.ind < self.positions.length) self.ind++;
              // camera.lookAt(pLast.x,pLast.y, pLast.z);
              pLast = pNextNext;
              camera.lookAt(pLast.x,pLast.y, pLast.z);
              
          } else if (keyCode == 70) {   // f
              camera.fov  += 10;
              camera.updateProjectionMatrix();              
          } else if (keyCode == 68) {   // d
              camera.fov  -= 10;
              camera.updateProjectionMatrix();
              // space
          } else if (keyCode == 90) {   // z
          }

         //animate();
      };
*/

/*      
      let centerLPS = this._stack.worldCenter();
      this.r4.camera.position.copy(this.axplane.position);
      this.r4.camera.up.set(1,0,0);
      this.r4.camera.updateProjectionMatrix();
      this.r4.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);

      let c = new THREE.Vector3(0,0,-1).unproject( this.r4.camera );
      let t = new THREE.Vector3(0,0,1).unproject( this.r4.camera );
      console.log('c & t',c,t)
      let xAxis = new THREE.Vector3(),  yAxis = new THREE.Vector3(), zAxiz = new THREE.Vector3();
      this.axplane['matrixWorld'].extractBasis(xAxis, yAxis, zAxiz)
      let p0 = new THREE.Vector3().fromArray(this.positions,this.ind*3)
      let lastInd = this.positions.length/3 -1, pLast = new THREE.Vector3().fromArray(this.positions,lastInd*3)

      this.r4.camera.far = 10; this.r4.camera.fov = 30;
      let  target = pLast;
      // target = new THREE.Vector3(0,0,0)

      function addSphereAtPoint(scene, point) {
        console.log('addSphereAtPoint');
        var sphereGeometry = new THREE.SphereGeometry( 5, 32, 16 );
        var faceColorMaterial = new THREE.MeshBasicMaterial({color:0x00ff00});
        var sphere = new THREE.Mesh( sphereGeometry, faceColorMaterial );
        sphere.position.set(point.x, point.y, point.z);
        scene.add(sphere);
        return sphere;
      }

      addSphereAtPoint(r0.scene, target);
      console.log('r4.camera.lookAt2 1',target)
      this.r4.camera.lookAt(target.x, target.y, target.z);
      this.r4.camera.updateProjectionMatrix();

      var cameraHelper = new THREE.CameraHelper(this.r4.camera);
      this.r4.scene.add(cameraHelper);
      var helper0 = new THREE.CameraHelper(this.r4.camera)
      helper0.visible = true;
      r0.scene.add(helper0);
      this.cameraHelperR4 = helper0;

      // light
      let light =  new THREE.SpotLight(0xffffff, 1.0);//new THREE.DirectionalLight(0xffffff, 1);
      light.position.copy(this.r4.camera.position);
      this.r4.scene.add(light);


      let huv = new HUV({left:300, top:200, width:300, height:100})
      cameraInfo(huv)
*/

      // function cameraInfo(huv) {
      //   // console.log('cameraInfo()')
      //   function toString(name, v3) {
      //     return name+' ('+v3.x.toFixed(2)+','+v3.y.toFixed(2)+','+v3.z.toFixed(2)+')';
      //   }
      //   // focus=10 fov=45 position up zoom
      //   let camera = self.r4.camera, target = camera._target;
      //   huv.clearText();
      //   let info = 'r4.camera info<br>';
      //   info += toString('position',camera.position) + '<br>';
      //   info += 'focus '+camera.focus+' fov '+camera.fov+' zoom '+camera.zoom + '<br>';
      //   info += toString('up',camera.up) +' far ' +camera.far + '<br>';
      //   huv.setText(info);
      // }


