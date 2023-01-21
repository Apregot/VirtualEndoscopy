// это серия тестов по производительности класса Cube
// Данные имитируют серию Колмыкова 512x512x193=50593792 вокселя
// интересно посмотреть производительность доступа для разных видов кубов
// (битовая маска, обычный куб, кубы с ROI), а также производительность 
// алгоритма marching cubes. Сейчас на кубе с ROI=[118x375,136x357,44x192]
// dims=[257,221,148]=8405956=16.6% (8405956 кратно 4, но не 8), из них
// единиц 367908=4.3%
// алгоритм работает 7 сек., что неприемлемо долго для LoadAortaPreviev
//

// проход по стандартному кубику Колмыкова
function test_cube_1() {
  const dims=[ 512, 512, 193], len = dims[0]*dims[1]*dims[2];
  const data = new Uint8Array(len);
  let cube = new Cube({dims:dims,data:data});
  let i,j,k,val;
  let t0 = performance.now();
    for(i=0; i<len; i++) val = data[i];
  console.log('проход по 50М ', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // проход по 50М  0.088  сек

  // t0 = performance.now();
  // for(i=0; i<dims[0]; i++)
  //   for(j=0; j<dims[1]; j++)
  //     for(k=0; k<dims[2]; k++)
  //       val = cube.getValue(i,j,k);
  // console.log('время обработки 50M getValue i-j-k', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 50M getValue i-j-k 6.981  сек

  t0 = performance.now();
  for(k=0; k<dims[2]; k++)
    for(j=0; j<dims[1]; j++)
      for(i=0; i<dims[0]; i++)          
        val = cube.getValue(i,j,k);
  console.log('время обработки 50M getValue k-j-i', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 50M getValue k-j-i 1.339  сек

  t0 = performance.now();
  const w=dims[0], h=dims[1], wh=w*h;
  let koff, joff;
  // const wh=dims[0]*dims[1], w=dims[0];
  for(k=0, koff=0; k<dims[2]; k++, koff+=wh)
    for(j=0, joff=0; j<dims[1]; j++, joff+=w)
      for(i=0; i<dims[0]; i++)          
        val = cube.data[i+joff+koff];
  console.log('время обработки 50M optimized k-j-i', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 50M optimized k-j-i 0.067  сек

  t0 = performance.now();
  for(i=0; i<len; i++) cube.lin2IJK(i)
  console.log('время обработки 50M lin2IJK', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 50M lin2IJK 1.509  сек

  t0 = performance.now();
  for(k=0; k<dims[2]; k++)
    for(j=0; j<dims[1]; j++)
      for(i=0; i<dims[0]; i++)          
        val = cube.IJK2lin(i,j,k);
  console.log('время обработки 50M IJK2lin', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 50M IJK2lin 0.098  сек

  t0 = performance.now();
  for(i=0; i<len; i++) Math.floor(i/2)
  console.log('время обработки 50M Math.floor()', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 50M Math.floor() 0.112  сек

  t0 = performance.now();
  val = [0,0,0];
  for(i=0; i<len; i++) {
    const I = i % w, J = ((i-I)/w)%h, K = Math.floor(i / wh)
    // val[0]=I; val[1]=J; val[2]=K; 
  }
  console.log('время обработки 50M симуляций lin2IJK с wh ', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 50M делений 0.094  сек
  // время обработки 50M умножений 0.113  сек
  // время обработки 50M остатков % 0.092  сек
  // время обработки 50M вычитаний 0.096  сек
  // время обработки 50M сложений 0.103  сек
  // время обработки 50M симуляций lin2IJK 1.484  сек (без возврата массива 0.822  сек)
  // время обработки 50M симуляций lin2IJK с внешним массивом  1.606  сек
  // время обработки 50M симуляций lin2IJK с wh  0.808  сек
}

// эксперименты с BITMASKWITHROI Cube
function test_cube_2() {
  const dims=[ 512, 512, 193], ROI=[118,375,136,357,44,192];
  const roiLengthUnpacked=8405956, off=roiLengthUnpacked%8, roiLengthPacked = (roiLengthUnpacked-off)/8+(off ? 1:0);
  let data = new Uint8Array(roiLengthPacked);
  let cube = new Cube({dims:dims,data:data,ROI:ROI,maskType:FSF.CONST.BITMASKWITHROI});

  let i,j,k,val;
  let t0 = performance.now();
  for(k=ROI[4]; k<=ROI[5]; k++)
    for(j=ROI[2]; j<=ROI[3]; j++)
      for(i=ROI[0]; i<=ROI[1]; i++)
        val = cube.getValue(i,j,k);
  console.log('время обработки 8.4M BITMASKWITHROI.getValue() ', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 8.4M BITMASKWITHROI.getValue()  0.482  сек == 2.87 сек на 50М 0.482*8=3.856

  // интересно, а во что обойдется пройтись по битмаске ROI
  const mask=[1,2,4,8,16,32,64,128]
  t0 = performance.now();
  for(i=0; i<roiLengthUnpacked; i++) {
    const off = i % 8, packedLinInd = (i-off)/8;    
    val =  (cube.data[packedLinInd] & (1 << 7-off)) ? 1 : 0;
    // val =  (cube.data[packedLinInd] & mask[off]) ? 1 : 0;
  }
  console.log('проход по BITMASKWITHROI 8.4M ', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // проход по BITMASKWITHROI 8.4M  0.061  сек --быстро, вопрос только, что мне нужно 8 линейных индексов вокруг IJK

  let edges = [], vertices=[], x=100,y=200,z=300, res=1.0;
  let box = ROI, roiDims = [box[1]-box[0]+1,box[3]-box[2]+1,box[5]-box[4]+1], w=roiDims[0], h=roiDims[1], wh=w*h;


  t0 = performance.now();
  for(k=ROI[4]; k<ROI[5]; k++) {
    let z = k * res;
    for(j=ROI[2]; j<ROI[3]; j++) {
      let y = j * res;
      for(i=ROI[0]; i<ROI[1]; i++) {
        let x = i * res;
        edges = [
            // Comment out the upper ones, and uncomment these commented ones
            // to disable interpolation
            new THREE.Vector3(x + res / 2, y, z),
            new THREE.Vector3(x + res, y, z + res / 2),
            new THREE.Vector3(x + res / 2, y, z + res),
            new THREE.Vector3(x, y, z + res / 2),
            new THREE.Vector3(x + res / 2, y + res, z),
            new THREE.Vector3(x + res, y + res, z + res / 2),
            new THREE.Vector3(x + res / 2, y + res, z + res),
            new THREE.Vector3(x, y + res, z + res / 2),
            new THREE.Vector3(x, y + res / 2, z),
            new THREE.Vector3(x + res, y + res / 2, z),
            new THREE.Vector3(x + res, y + res / 2, z + res),
            new THREE.Vector3(x, y + res / 2, z + res),
        ];

        // let state = getState(
        //     cube.getValue(i,j,k),
        //     cube.getValue(i + 1,j,k),
        //     cube.getValue(i + 1,j,k + 1),
        //     cube.getValue(i,j,k + 1),
        //     cube.getValue(i,j + 1,k),
        //     cube.getValue(i + 1,j + 1,k),
        //     cube.getValue(i + 1,j + 1,k + 1),
        //     cube.getValue(i,j + 1,k + 1)
        // );

        let ijkLinInd = (i-box[0])+(j-box[2])*w+(k-box[4])*wh;
        let state = getState(
            cube.getValueROI(ijkLinInd), //this.getValue(i,j,k),
            cube.getValueROI(ijkLinInd+1), //this.getValue(i + 1,j,k),
            cube.getValueROI(ijkLinInd+1+wh), //this.getValue(i + 1,j,k + 1),
            cube.getValueROI(ijkLinInd+wh), //this.getValue(i,j,k + 1),
            cube.getValueROI(ijkLinInd+w), //this.getValue(i,j + 1,k),
            cube.getValueROI(ijkLinInd+1+w), //this.getValue(i + 1,j + 1,k),
            cube.getValueROI(ijkLinInd+1+w+wh), //this.getValue(i + 1,j + 1,k + 1),
            cube.getValueROI(ijkLinInd+w+wh), //this.getValue(i,j + 1,k + 1)
        );


        // for (let edgeIndex of triangulationTable[state]) 
        //       if (edgeIndex !== -1) 
        //           vertices.push(edges[edgeIndex].x, edges[edgeIndex].y, edges[edgeIndex].z);

      }   
    }                  
  }
  console.log('время обработки 8.4M edges [] c state и getValueROI', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 8.4M edges []  0.771  сек
  // время обработки 8.4M edges [] c state  5.517  сек
  // время обработки 8.4M edges [] c state и vertices.push 5.404  сек (а где еще 3 сек?)
  // время обработки 8.4M edges [] c state и getValueROI 2.181  сек

  function getState(a, b, c, d, e, f, g, h) { return a * 1 + b * 2 + c * 4 + d * 8 + e * 16 + f * 32 + g * 64 + h * 128; }
  t0 = performance.now();
  for(i=0; i<roiLengthUnpacked; i++) val = getState(0,1,1,0,0,1,1,0);
  console.log('время обработки 8.4M getState ', ((performance.now()-t0)/1000).toFixed(3),' сек');
  // время обработки 8.4M getState  0.042  сек

  t0 = performance.now();
  val = cube.marchingCubes()
  console.log('marchingCubes 8.4M verts ', ((performance.now()-t0)/1000).toFixed(3),' сек');
  console.log('val',val)
  //marchingCubes 8.4M verts  8.057  сек

  // let triangulationTable = [];
  // for(let i=0; i<256; i++)
  //   triangulationTable.push([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]);
  let state = 0, halfRes=0.5;
                    edges = [
                        // Comment out the upper ones, and uncomment these commented ones
                        // to disable interpolation
                        [x + halfRes, y, z],
                        [x + res, y, z + halfRes],
                        [x + halfRes, y, z + res],
                        [x, y, z + halfRes],
                        [x + halfRes, y + res, z],
                        [x + res, y + res, z + halfRes],
                        [x + halfRes, y + res, z + res],
                        [x, y + res, z + halfRes],
                        [x, y + halfRes, z],
                        [x + res, y + halfRes, z],
                        [x + res, y + halfRes, z + res],
                        [x, y + halfRes, z + res],
                    ];

  t0 = performance.now();
  for(i=0; i<roiLengthUnpacked; i++)
    for (let edgeIndex of triangulationTable[state]) 
      if (edgeIndex !== -1) 
          vertices.push(edges[edgeIndex][0], edges[edgeIndex][1], edges[edgeIndex][2]);
  console.log('for of triangulationTable 8.4M verts ', ((performance.now()-t0)/1000).toFixed(3),' сек');
}
