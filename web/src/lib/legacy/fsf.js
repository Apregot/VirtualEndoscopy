/**
 * Реализация FFR Stream Format 
 * LFTTTTDD, где L - признак длинных индексов (4 байта), F - флаг FIN, TTTT - дескриптор типа, DD - размерность данных
 * TTTT 0:Int8, 1:Uint8, 2:Int16, 3:Uint16, 4:Int32, 5:Uint32, 6:Float32, 7:Float64, 8:UTF-8 string, 9 битовый куб с ROI
 * 10-13 резерв, 14:команда(L=0) или код ответа(L=1), 15:специальные маркеры
 */

 export var FSF = FSF || {};

 FSF.CONST = {
    OK:     0xB8,       // LFTTTTDD: L=1 F=0 TTTT=14 DD=0: 10111000 =0xB8 =184
    ERROR:  0xB9,       // LFTTTTDD: L=1 F=0 TTTT=14 DD=1: 10111001 =0xB9 =185;     <FSF::ERROR><P><FSF::STRING>
    FIN:    (1<<6),     // 0x40
    LONGIND:(1<<7),     // 0x80
    STRING: 0x21,       // 00100001: =0x21 =33
    PAD:    0x3C,       // PADDING
    Uint8Arr: 0x5,      // Uint8Array 1-dim xx000101 = 0x5
    Int32Arr: 0x11,     // Int32Array 1-dim xx010001 = 0x11 = 17  (короткие и длинные индексы)
    Float32Arr: 0x19,   // Float32Array 1-dim xx011001 = 0x19 = 25  (короткие и длинные индексы)
    FLOAT64:0x1D,       // Float64Array 1-dim 00011101: =0x1D =29 (только короткие индексы)
    BITMASK:0x25,       // 00100101: TTTT=9  DD=01 воксельная маска куба в виде упакованного битового массива
    MASKWITHROI:0x26,   // 00100110: TTTT=9  DD=10 воксельная маска куба c ROI (Region Of Interest)
    BITMASKWITHROI:0x27,// 00100111: TTTT=9  DD=11 воксельная битовая маска куба c ROI (Region Of Interest)
 }
/** 
 * @typedef {{
 *            data:(!Uint8Array),
 *            offset:(!number),
 *          }}
 */
export var FSFbufType;

/** 
 * FSFProtoCube - это объект, который может передаваться конструктору Cube
 * Я намереренно отказался от того, чтобы FSF работало непосредственно с классом Cube, тем самым развязывая 
 * FSF от зависимости Cube от THREE.JS. До сих пор FSF полагается лишь на встроенные типы JavaScript и тем самым
 * может использоваться в любом фреймворке. FSF - это транспортный уровень двоичной передачи данных.
 * dims:Array<{3:number}>,
 * @typedef {{
 *            data:TypedArray,
 *            dims:Array<number>,
 *            maskType:(number|undefined),
 *            ROI:(Array<number>|undefined)
 *          }}
 */
export var FSFProtoCube;



 FSF.type = function(a) {
 	// 0:Int8, 1:Uint8, 2:Int16, 3:Uint16, 4:Int32, 5:Uint32, 6:Float32, 7:Float64, 
 	const types = ['Int8Array', 'Uint8Array','Int16Array','Uint16Array','Int32Array','Uint32Array','Float32Array','Float64Array'];
 	const typedArray = (ArrayBuffer.isView( a) && !(a instanceof DataView));
 	return (typedArray ? types.indexOf(a.constructor.name) : -1); 		
 }

 /**
  * Парсинг маркера FSF::STRING
  * @param {!FSFbufType} fsfbuf
  * @return {string}
  */ 
 FSF.parseString = function(fsfbuf) {
   let data = /** @type {Uint8Array}*/(fsfbuf.data),  offset = fsfbuf.offset;
   if(data[offset] != FSF.CONST.STRING) 
      throw new Error('FSF: invalid STRING marker');
   if(offset+3 >= data.length)
       throw new Error('FSF: unsufficient buffer length');
   let len = data[offset+2]*256+data[offset+3];
   if(offset+len+4 > data.length)
       throw new Error('FSF: unsufficient buffer length');
   fsfbuf.offset += len+4;   // маркер == 4 байта
   return fromUTF8Array(data,offset+4,len);
 }

 /**
  * Парсинг маркера FSF::FLOAT64 (1-dim short index)
  * @param {!FSFbufType} fsfbuf
  * @return {Float64Array}
  */ 
 FSF.parseFloat64Array = function(fsfbuf) {
   const descSize = 8;
   let data = /** @type {Uint8Array}*/(fsfbuf.data),  offset = fsfbuf.offset;
   if(data[offset] != FSF.CONST.FLOAT64) 
      throw new Error('FSF: invalid Float64Array marker');
   if(offset+descSize > data.length)
       throw new Error('FSF: unsufficient buffer length');
   let n1 = data[offset+2]*256+data[offset+3];
   if(offset+descSize+n1*8 > data.length) // 8 - размер double и Fload64
       throw new Error('FSF: unsufficient buffer length');
   let f64Array = new Float64Array(data.buffer,offset+descSize,n1); 
   fsfbuf.offset += descSize+n1*8
   return f64Array;
 }

 /**
  * Парсинг маркера FSF::MASKWITHROI - воксельная маска куба c ROI
  * @param {!FSFbufType} fsfbuf
  * @return {FSFProtoCube}
  */ 
 FSF.parseMaskWithRoi = function(fsfbuf) {

    const descSize = 20; // 2+dims[3]+ROI[6] = 20 байт
    let data = /** @type {Uint8Array}*/(fsfbuf.data),  offset = fsfbuf.offset;
    const L = (data[offset] & FSF.CONST.LONGIND), marker = (data[offset] & ~(FSF.CONST.FIN | FSF.CONST.LONGIND));
    if(marker != FSF.CONST.MASKWITHROI) 
       throw new Error('FSF: invalid MASKWITHROI marker');
    if(offset+descSize > data.length)
       throw new Error('FSF: unsufficient buffer length');
    const n1 = data[offset+2]*256+data[offset+3];
    const n2 = data[offset+4]*256+data[offset+5];
    const n3 = data[offset+6]*256+data[offset+7];
    const r1 = data[offset+8]*256+data[offset+9];
    const r2 = data[offset+10]*256+data[offset+11];
    const r3 = data[offset+12]*256+data[offset+13];
    const r4 = data[offset+14]*256+data[offset+15];
    const r5 = data[offset+16]*256+data[offset+17];
    const r6 = data[offset+18]*256+data[offset+19];
    const roi = [r1,r2,r3,r4,r5,r6], zeroROI = L   // это признак zero-ROI

    // куб ROI включает границы, это не dims, поэтому в вычислениях участвует +1
    const dataSize = (zeroROI ? 0 :(r2-r1+1) * (r4-r3+1) * (r6-r5+1));
    if(offset+descSize+dataSize > data.length)
       throw new Error('FSF: unsufficient buffer length');

    let mask = new Uint8Array(data.buffer,offset+descSize,dataSize);
    dataSize == 0 &&  console.assert(mask.length == 0, 'mask should be zero-length Uint8Array ', mask)

    fsfbuf.offset += descSize+dataSize;

    return {dims:[n1,n2,n3],data:mask, maskType:FSF.CONST.MASKWITHROI, ROI:roi}
 }

 /**
  * Парсинг маркера FSF::BITMASKWITHROI - воксельная битовая маска куба c ROI
  * если ROI = {0,0,0,0,0,0} и L=1 (zero ROI), то в кубе нет единиц
  * @param {!FSFbufType} fsfbuf
  * @return {FSFProtoCube}
  */ 
 FSF.parseBitMaskWithRoi = function(fsfbuf) {

    const descSize = 20; // 2+dims[3]+ROI[6] = 20 байт
    let data = /** @type {Uint8Array}*/(fsfbuf.data),  offset = fsfbuf.offset;
    const L = (data[offset] & FSF.CONST.LONGIND), marker = (data[offset] & ~(FSF.CONST.FIN | FSF.CONST.LONGIND));
    if(marker != FSF.CONST.BITMASKWITHROI) 
       throw new Error('FSF: invalid BITMASKWITHROI marker');
    if(offset+descSize > data.length)
       throw new Error('FSF: unsufficient buffer length');
    const n1 = data[offset+2]*256+data[offset+3];
    const n2 = data[offset+4]*256+data[offset+5];
    const n3 = data[offset+6]*256+data[offset+7];
    const r1 = data[offset+8]*256+data[offset+9];
    const r2 = data[offset+10]*256+data[offset+11];
    const r3 = data[offset+12]*256+data[offset+13];
    const r4 = data[offset+14]*256+data[offset+15];
    const r5 = data[offset+16]*256+data[offset+17];
    const r6 = data[offset+18]*256+data[offset+19];
    const roi = [r1,r2,r3,r4,r5,r6], zeroROI = L   // это признак zero-ROI

    // куб ROI включает границы, это не dims, поэтому в вычислениях участвует +1
    const roiSize = (zeroROI ? 0 : (r2-r1+1) * (r4-r3+1) * (r6-r5+1))
    const off = roiSize%8;
    const dataSize = ((roiSize-off)/8 | 0) +(off > 0 ? 1 : 0);
    if(offset+descSize+dataSize > data.length)
       throw new Error('FSF: unsufficient buffer length');

    let mask = new Uint8Array(data.buffer,offset+descSize,dataSize);
    dataSize == 0 &&  console.assert(mask.length == 0, 'mask should be zero-length Uint8Array ', mask)
      
    fsfbuf.offset += descSize+dataSize;

    return {dims:[n1,n2,n3],data:mask, maskType:FSF.CONST.BITMASKWITHROI, ROI:roi}
 }

 /**
  * Парсинг маркера FSF::BITMASK - воксельная маска куба, переданная как упакованный битовый массив
  * @param {!FSFbufType} fsfbuf
  * @return {FSFProtoCube}
  */ 
 FSF.parseBitMaskCube = function(fsfbuf) {

    const descSize = 8;
    let data = /** @type {Uint8Array}*/(fsfbuf.data),  offset = fsfbuf.offset;
    if(data[offset] != FSF.CONST.BITMASK) 
       throw new Error('FSF: invalid BITMASK marker');
    if(offset+descSize > data.length)
       throw new Error('FSF: unsufficient buffer length');
    const n1 = data[offset+2]*256+data[offset+3];
    const n2 = data[offset+4]*256+data[offset+5];
    const n3 = data[offset+6]*256+data[offset+7];
    const unpackedSize = n1 * n2 * n3, packedSize = unpackedSize / 8;
    console.log('dims&packed size offset',n1,n2,n3,packedSize, offset)
    if(unpackedSize % 8)
       throw new Error('FSF::parseBitMaskCube воксельная маска должна иметь размер кратный 8');
    if(offset+descSize+packedSize > data.length)
       throw new Error('FSF: unsufficient buffer length');

    let mask = new Uint8Array(data.buffer,offset+descSize,packedSize);
    fsfbuf.offset += descSize+packedSize;

    return {dims:[n1,n2,n3],data:mask, maskType:FSF.CONST.BITMASK}
 }


 /**
  * Парсинг маркера FSF::Uint8Array (1-dim)
  * Это первый случай, когда задействуются длинные индексы (картинка среза аорты > 65К)
  * @param {!FSFbufType} fsfbuf
  * @return {Uint8Array}
  */ 
 FSF.parseUint8Array = function(fsfbuf) {
   // console.log('FSF.parseUint8Array()')
   let data = /** @type {Uint8Array}*/(fsfbuf.data),  offset = fsfbuf.offset;
   const L = (data[offset] & FSF.CONST.LONGIND), marker = (data[offset] & ~(FSF.CONST.FIN | FSF.CONST.LONGIND));
   if(marker != FSF.CONST.Uint8Arr) 
      throw new Error('FSF: invalid Uint8Array marker');
   const lengthBytes = (L ? 4 : 2);
   if(offset+lengthBytes >= data.length)
       throw new Error('FSF: unsufficient buffer length');

   let len = (L ? data[offset+2]*256*256*256+data[offset+3]*256*256+data[offset+4]*256+data[offset+5]
                : data[offset+2]*256+data[offset+3]);
   // console.log(' FSF.parseUint8Array len=',len)
   if(offset+len+lengthBytes >= data.length)
       throw new Error('FSF: unsufficient buffer length');
   fsfbuf.offset += len+2+lengthBytes;   // маркер == 2 байта + индекс
   return new Uint8Array(data.buffer,offset+2+lengthBytes,len);
 }

 /**
  * Парсинг маркера FSF::Int32Array (1-dim)
  * Это второй случай, когда нужны длинные индексы (число вокселей на поверхности аорты Швец 94200)
  * @param {!FSFbufType} fsfbuf
  * @return {Int32Array}
  */ 
 FSF.parseInt32Array = function(fsfbuf) {
   let data = /** @type {Uint8Array}*/(fsfbuf.data),  offset = fsfbuf.offset;
   const L = (data[offset] & FSF.CONST.LONGIND), marker = (data[offset] & ~(FSF.CONST.FIN | FSF.CONST.LONGIND));
   if(marker != FSF.CONST.Int32Arr) 
      throw new Error('FSF: invalid Int32Array marker');
   // в коротком формате длина записана как uint16 без padding,
   // а в длинном формате как uint32 + 2 байта padding для выравнивания Int32Array на 4-ч байтовую границу
   const dimLengthBytes = (L ? 6 : 2);
   if(offset+dimLengthBytes >= data.length)
       throw new Error('FSF: unsufficient buffer length');
   let dim0 = (L ? data[offset+2]*256*256*256+data[offset+3]*256*256+data[offset+4]*256+data[offset+5]
                : data[offset+2]*256+data[offset+3]);
   // console.log(' FSF.parseInt32Array dim=',dim0)
   if(offset+dim0+dimLengthBytes >= data.length)
       throw new Error('FSF: unsufficient buffer length');
   fsfbuf.offset += 2+dimLengthBytes+dim0*4;   // маркер == 2 байта + индекс
   return new Int32Array(data.buffer,offset+2+dimLengthBytes,dim0);
 }

 /**
  * Парсинг маркера FSF::Float32Array (1-dim)
  * Это третий случай, когда нужны длинные индексы (число вокселей на поверхности аорты Швец 94200)
  * @param {!FSFbufType} fsfbuf
  * @return {Float32Array}
  */ 
 FSF.parseFloat32Array = function(fsfbuf) {
   let data = /** @type {Uint8Array}*/(fsfbuf.data),  offset = fsfbuf.offset;
   const L = (data[offset] & FSF.CONST.LONGIND), marker = (data[offset] & ~(FSF.CONST.FIN | FSF.CONST.LONGIND));
   if(marker != FSF.CONST.Float32Arr) 
      throw new Error('FSF: invalid Float32Array marker');
   // в коротком формате длина записана как uint16 без padding,
   // а в длинном формате как uint32 + 2 байта padding для выравнивания Int32Array на 4-ч байтовую границу
   const dimLengthBytes = (L ? 6 : 2);
   if(offset+dimLengthBytes >= data.length)
       throw new Error('FSF: unsufficient buffer length');
   let dim0 = (L ? data[offset+2]*256*256*256+data[offset+3]*256*256+data[offset+4]*256+data[offset+5]
                : data[offset+2]*256+data[offset+3]);
   // console.log(' FSF.parseFloat32Array dim=',dim0)
   if(offset+dim0+dimLengthBytes >= data.length)
       throw new Error('FSF: unsufficient buffer length');
   fsfbuf.offset += 2+dimLengthBytes+dim0*4;   // маркер == 2 байта + индекс
   return new Float32Array(data.buffer,offset+2+dimLengthBytes,dim0);
 }

 /**
  * Раскодирует FSF-объекты, находящиеся в данном ArrayBuffer и возвращает массив JavaScript объектов им соотвествующих
  * @param {!ArrayBuffer} buffer
  * @return {Array}
  */
 FSF.parseBuffer = function(buffer) {
    // return [{result:false, reason:'test error'}];
    let data = new Uint8Array(buffer);
    let parts = [];
    const F = FSF.CONST.FIN, L=FSF.CONST.LONGIND;
    let fbuf = /** @type FSFbufType */({data:data, offset:0});

    while(fbuf.offset < data.length) {
      const elem = data[fbuf.offset], FIN = elem & FSF.CONST.FIN, marker = elem & ~FSF.CONST.FIN;

      if(marker == FSF.CONST.PAD) 
         fbuf.offset++;
      else if(marker == FSF.CONST.OK) {   // после маркера OK идет нулевой байт
         parts.push({result:true});
         fbuf.offset +=2;
      }
      else if(marker == FSF.CONST.ERROR) {   //<FSF::ERROR><P><FSF::STRING>
         console.log('fbuf',fbuf)
         let errObj = {result:false, code:data[fbuf.offset+1], reason:''};    // да без проверки offset+1 на выход за границу
         fbuf.offset += 2; //<FSF::ERROR><P>
         errObj.reason = FSF.parseString(fbuf);
         parts.push(errObj);
         //console.log('errObj',errObj)
      }
      else if((marker&~FSF.CONST.LONGIND) == FSF.CONST.Uint8Arr) 
         parts.push(FSF.parseUint8Array(fbuf));
      else if((marker&~FSF.CONST.LONGIND) == FSF.CONST.Int32Arr) 
         parts.push(FSF.parseInt32Array(fbuf));
      else if((marker&~FSF.CONST.LONGIND) == FSF.CONST.Float32Arr) 
         parts.push(FSF.parseFloat32Array(fbuf));
      else if(marker == FSF.CONST.FLOAT64)
         parts.push(FSF.parseFloat64Array(fbuf));
      else if(marker == FSF.CONST.BITMASK)
         parts.push(FSF.parseBitMaskCube(fbuf));
      else if((marker&~FSF.CONST.LONGIND) == FSF.CONST.MASKWITHROI)
         parts.push(FSF.parseMaskWithRoi(fbuf));
      else if((marker&~FSF.CONST.LONGIND) == FSF.CONST.BITMASKWITHROI)
         parts.push(FSF.parseBitMaskWithRoi(fbuf));
      else {
         console.log('FSF: fbuf ',FSF.strBuffer(fbuf))     
         throw new Error('FSF: invalid marker '+elem.toString(16));         
      }
    }

    return parts;
 }

 /**
  * 16-ричный дамп потока
  * @param {!FSFbufType} fsfbuf
  * @param {number=} opt_maxlen
  * @return {string}
  */ 
 FSF.strBuffer = function (fsfbuf, opt_maxlen) {
   // console.log('FSF.strBuffer fsfbuf=',fsfbuf)
   return hex(fsfbuf.data.subarray(fsfbuf.offset));
 }

 /**
  * Возвращает FSF дескриптор для данного TypedArray
  * @param {!TypedArray} array
  * @param {!Array=} dims	// если dims присутствует, то именно он опеределяет размерность массива, а сам массив только тип
  * @return {Uint8Array}
  */
 FSF.D = function(array, dims) {
 	dims = dims || [array.length];
	// console.log('FSF.D dims=',dims)
	const ndims = dims.length & 3;
	// array.length == dims[0]*[dims[1]*[dims[2]]]
 	const t =FSF.type(array);
 	if(t==-1) 
 		throw new Error('unknown FSF type');
 	// LFTTTTDD
 	let fsd = new Uint8Array([t<<2 | ndims,0,0,0,0,0,0,0]);	
 	for(var i=0; i<ndims; i++) {
 		fsd[2+2*i] = (dims[i]>>8)&255;
 		fsd[2+2*i+1] = dims[i]&255;
 	}
 	return fsd;
 }

 /**
  * 00111000 00000011 = 0x38 0x3 = 56 3
  * @param {!number}       code код команды
  * @return {Uint8Array}   команда в кодировке FSF   
  */
 FSF.CMD = function(code) {
 	let cmd = new Uint8Array(2);
 	cmd[0] = 56; cmd[1] = code;
 	return cmd;
 }

  /**
  * Возвращает FSF скалярного типа (пока не очень ясно, как отличать например int от float)
  * @param {!number} n
  * @return {Uint8Array}
  * LFTTTTDD: 00011101 0x0 0x0001 0x0000 0x0000		 	
  * 0:Int8, 1:Uint8, 2:Int16, 3:Uint16, 4:Int32, 5:Uint32, 6:Float32, 7:Float64
  * 00000000  <int8>; 00000100 <uint8>; 00001000 00000000 <[U]int16> и т.д.
  */
FSF.Scalar = function(n) {
	let fsf = new Uint8Array(2);	// tttt=0, то еть int8
	fsf[1] = n;
	return fsf;
 }

/**
* Формирует одномерный FSF массив из TypedArray  
* @param {!TypedArray} array  	
* @return {Blob}
*/
 FSF.Array = function(array) {
 	// if(array.constructor.name !== 'Uint8Array') 	// пока так
 	// 	throw new Error('array must be TypedArray');
 	return new Blob([FSF.D(array),array]);
 }

 // LFTTTTDD: 00011101 0x0 0x0001 0x0000 0x0000 [data=Float64Array]
 // это старый код, написанный еще до FSF.D --нигде не используется
FSF.Float64Array = function(array) {
 	const len = 8+array.length*8;	// FSD+data
 	console.log('array.length',array.length)
 	let arrayBuffer = new ArrayBuffer(len);
	let view = new DataView(/** @type {ArrayBuffer} */ (arrayBuffer)); 
	view.setUint8(0,29); // 00011101
	view.setUint8(1,0); 
	view.setUint16(2,array.length);
	for(var i=0; i<array.length; i++)
		view.setFloat64(8+i*8,array[i],true);
	return arrayBuffer;
 }
/**
* Возвращает одномерный FSF массив, упакованный как Float32Array  
* @param {!Array} array  	
* @return {Blob}
*/
// LFTTTTDD: 00011001 0x0 <len>(2) 0x0000 0x0000 [TTTT=6 Float32Array]
 FSF.Float32Array = function(array) {
 	let data = Float32Array.from(array)
	return new Blob([FSF.D(data),data]);
 }	
 
 async function testBinaryFSF() {
 	let arrayBuffer8 = new ArrayBuffer(8); let f64 = new Float64Array(arrayBuffer8); f64[0] = 3.14;	
 	console.log('Float64(3.14)=',arrayBuffer8, hex(arrayBuffer8)); // Uint6: 31 133 235 81 184 30 9 64   hex: 1f 85 eb 51 b8 1e 9 40
 	// на С double 3.14 имеет такое же представление hex: 1f 85 eb 51 b8 1e 9 40 (это litle-endian LSB)
 	// если послать WebSocket.send(new Float64Array([3.14])), то на сервер приходит 1f 85 eb 51 b8 1e 9 40
 	// однако если сформировать буфер через DataView.setFloat64(0,3.14), то данные придут в обратном порядке big-endian MSB
 	// если указать 3 параметр true DataView.setFloat64(0,3.14,true), то данные придут в litle-endian порядке 
 	let arrayBuffer4 = new ArrayBuffer(4); let f32 = new Float32Array(arrayBuffer4); f32[0] = 3.14;
 	console.log('Float32(3.14)=',arrayBuffer4, hex(arrayBuffer4));	// c3 f5 48 40
 	let b1 = new Blob([3.14]);
 	console.log('blob b1=',b1,b1.arrayBuffer());
 	let b1buf = await b1.arrayBuffer();
 	console.log('b1buf=',b1buf);
 }

 /**
  * Возвращает 16-ричную строку первых maxLen (default 16) байт в ArrayBuffer
  * @param {!ArrayBuffer | !Uint8Array} array
  * @param {number=} opt_maxLen	
  * @return {string}
  */
 function hex(array, opt_maxLen) {	// number.toString(16).toUpperCase();
   // 
 	let nMax = opt_maxLen || 16;
   let n = (array instanceof Uint8Array ? array : new Uint8Array(array));
 	if(nMax > n.length) nMax = n.length;
 	let str = '';
 	for(var i=0; i<nMax; i++)
 		str += n[i].toString(16)+' ';
 	return str;
 }