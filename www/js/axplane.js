class Axplane extends THREE.Group {
  constructor() {
    super();
    const SIZE = 20, origin = new THREE.Vector3( 0, 0, 0 );
    this.normal = new THREE.Vector3( 0, 0, 1 );
    this.zarrow = new THREE.ArrowHelper(this.normal, origin, SIZE/2, 0x0000FF, SIZE/5, SIZE/10);
    this.xarrow = new THREE.ArrowHelper( new THREE.Vector3( 1, 0, 0 ), origin, SIZE/2, 0xFF0000, SIZE/5, SIZE/10);
    this.yarrow = new THREE.ArrowHelper( new THREE.Vector3( 0, 1, 0 ), origin, SIZE/2, 0x00FF00, SIZE/5, SIZE/10);
    let axplaneMaterial = new THREE.MeshBasicMaterial({color: 0x909090, side: THREE.DoubleSide, transparent: true, opacity: 0.5});
    var axplaneGeometry = new THREE.PlaneGeometry(SIZE, SIZE, 1, 1);
    this.axplane = new THREE.Mesh(axplaneGeometry, axplaneMaterial);
    this.add(this.axplane);
    this.add(this.zarrow);
    this.add(this.xarrow);
    this.add(this.yarrow);
 }

 setColor(color) {this.axplane['material'].color.setHex(color);}

  setPositionAndNormal(position, normal) {
    let point = position.clone().add(normal);
    this.position.copy(position)
    this.lookAt(point);
    this.normal = normal.clone().normalize();
  }

  plane() {
    // console.log('plane normal and position',this.normal, this.position)
    return new THREE.Plane().setFromNormalAndCoplanarPoint(this.normal,this.position)
  }

  /** @param {boolean} vis */
  setAxesVisible(vis) {
    this.xarrow.visible = vis;
    this.yarrow.visible = vis;
    this.zarrow.visible = vis;
  }
  // на входе THREE.Geometry
  // на выходе new Three.Geometry, у которой vertices являются точками пересечения плоскости и данной геометрии
  // a fаces[] являются индексами граней пересечения _исходной_ геометрии (чтобы их можно было покрасить)
  // то есть возвращенная геометрия является объектом, к котором хранятся vertices и faces, но они не связаны между собой
  sliceGeometry(mesh) {
    // пересечением плоскости и face может быть 1) пустое множество 2) точка 3) отрезок 4) face
    let t0=performance.now();

    let _slice = new THREE.Geometry(), _plane = this.plane(), cnt = 0;
    var a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let  pointOfIntersection1 = new THREE.Vector3(), pointOfIntersection2 = new THREE.Vector3(), pointOfIntersection3 = new THREE.Vector3();

    // let ia = mesh.geometry.faces[0].a, aL = mesh.geometry.vertices[ia].clone(); 
    // let aWorld = aL.clone(); mesh.localToWorld(aWorld);
    // let aW1 = mesh.getWorldPosition(aL.clone());
    // console.log('mesh.matrixWorld',mesh.matrixWorld, aL, aWorld,aW1);

    function addNoDup(geom,v,faceInd) {
        if(!v || v.x !== v.x || v.y !== v.y || v.z !== v.z) return true;
        let vertices = geom.vertices, faces = geom.faces;
        const EPS = 1e-6;
        let dup = false;
        for(var i=0; i<vertices.length; i++)
            if(vertices[i].distanceToSquared(v) < EPS) {dup=true; break;}
        if(!dup) {
            vertices.push(v.clone());
            // console.log('addNoDup v=',v,'accepted')
        }
        // else console.log('addNoDup v=',v,'rejected')
        dup = false;
        for(var i=0; i<faces.length; i++)
            if(faces[i] == faceInd) {dup=true; break;}
        if(!dup) faces.push(faceInd);
        return false;
    }
 
    mesh.updateMatrixWorld();
    if(mesh.geometry instanceof THREE.Geometry) {
        mesh.geometry.faces.forEach(function(face, idx) {
            a = mesh.localToWorld(mesh.geometry.vertices[face.a].clone());
            b = mesh.localToWorld(mesh.geometry.vertices[face.b].clone());
            c = mesh.localToWorld(mesh.geometry.vertices[face.c].clone());
            // console.log('abc',a,b,c); 
            let lineAB = new THREE.Line3(a, b), lineBC = new THREE.Line3(b, c), lineCA = new THREE.Line3(c,a);
            if(_plane.intersectLine(lineAB, pointOfIntersection1)) 
                if(addNoDup(_slice, pointOfIntersection1,idx)) {console.log('ab',a,b,c,idx,face)};
            if(_plane.intersectLine(lineBC, pointOfIntersection2)) 
                if(addNoDup(_slice, pointOfIntersection2,idx)) {console.log('bc',a,b,c,idx,face)};
            if(_plane.intersectLine(lineCA, pointOfIntersection3)) 
                if(addNoDup(_slice, pointOfIntersection3,idx)) {console.log('ca',a,b,c,idx,face)};
        });
    }
    else if(mesh.geometry instanceof THREE.BufferGeometry) {
        const positionAttribute = mesh.geometry.getAttribute( 'position' );
        const facesNum = positionAttribute.count / 3; 
        let c1=false,c2=false,c3=false;
        let lineAB = new THREE.Line3(a, b), lineBC = new THREE.Line3(b, c), lineCA = new THREE.Line3(c,a);

        for(var i=0; i<facesNum; i++ ) {
            a.fromBufferAttribute( positionAttribute, 3*i+0 ); a = mesh.localToWorld(a);
            b.fromBufferAttribute( positionAttribute, 3*i+1 ); b = mesh.localToWorld(b);
            c.fromBufferAttribute( positionAttribute, 3*i+2 ); c = mesh.localToWorld(c);
            lineAB.set(a, b); lineBC.set(b, c); lineCA.set(c,a);
            if(c1=_plane.intersectLine(lineAB, pointOfIntersection1)) 
                if(addNoDup(_slice, pointOfIntersection1,i)) {console.log('ab',a,b,c, pointOfIntersection1,i); break;};
            if(c2=_plane.intersectLine(lineBC, pointOfIntersection2)) 
                if(addNoDup(_slice, pointOfIntersection2,i)) {console.log('bc',a,b,c, pointOfIntersection2,i); break;};
            if(c3=_plane.intersectLine(lineCA, pointOfIntersection3)) 
                if(addNoDup(_slice, pointOfIntersection3,i)) {console.log('ca',a,b,c, pointOfIntersection3,i); break;};
        }
        // console.log('abc',a,b,c);   
    }

    // console.log('cnt',cnt)
    let t1 = performance.now();
    // console.log('axplane::sliceGeometry() elapsed time',t1-t0)
    return _slice;
  }

  slicePoints(mesh) {
    var pointsMaterial = new THREE.PointsMaterial({ size: 0.5, color: 0xffffff });
    return new THREE.Points(this.sliceGeometry(mesh), pointsMaterial);
  }

}
