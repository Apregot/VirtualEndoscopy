/* eslint-disable no-multi-spaces */

import { type TypedArray } from 'three';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
enum Const {
    OK = 0xB8,              // LFTTTTDD: L=1 F=0 TTTT=14 DD=0: 10111000 =0xB8 =184
    ERROR = 0xB9,           // LFTTTTDD: L=1 F=0 TTTT=14 DD=1: 10111001 =0xB9 =185;     <FSF::ERROR><P><FSF::STRING>
    FIN = (1 << 6),         // 0x40
    LONGIND = (1 << 7),     // 0x80
    STRING = 0x21,          // 00100001: =0x21 =33
    PAD = 0x3C,             // PADDING
    Uint8Arr = 0x5,         // Uint8Array 1-dim xx000101 = 0x5
    Int32Arr = 0x11,        // Int32Array 1-dim xx010001 = 0x11 = 17  (короткие и длинные индексы)
    Float32Arr = 0x19,      // Float32Array 1-dim xx011001 = 0x19 = 25  (короткие и длинные индексы)
    FLOAT64 = 0x1D,         // Float64Array 1-dim 00011101: =0x1D =29 (только короткие индексы)
    BITMASK = 0x25,         // 00100101: TTTT=9  DD=01 воксельная маска куба в виде упакованного битового массива
    MASKWITHROI = 0x26,     // 00100110: TTTT=9  DD=10 воксельная маска куба c ROI (Region Of Interest)
    BITMASKWITHROI = 0x27,  // 00100111: TTTT=9  DD=11 воксельная битовая маска куба c ROI (Region Of Interest)
}

interface FSFbufType {
    data: Uint8Array
    offset: number
}

interface FSFProtoCube {
    data: TypedArray
    dims: number[]
    maskType: number | undefined
    ROI: number[]

}
class FSF {
    public static cmd(commandCode: number): Uint8Array {
        const cmd = new Uint8Array(2);
        cmd[0] = 56; cmd[1] = commandCode;
        return cmd;
    }

    // Формирует одномерный FSF массив из TypedArray  
    public static array(array: TypedArray): Blob {
        // if(array.constructor.name !== 'Uint8Array') // пока так
        // throw new Error('array must be TypedArray');
        return new Blob([FSF.d(array), array]);
    }

    // Возвращает FSF дескриптор для данного TypedArray, если dims присутствует, то именно он опеределяет размерность массива, а сам массив только тип
    public static d(array: TypedArray, dims?: number[]): Uint8Array {
        if (typeof dims === 'undefined') {
            dims = [array.length];
        };
        const ndims = dims.length & 3;

        const t = this.getArrayType(array);
        if (t === -1) { throw new Error('unknown FSF type'); }
        // LFTTTTDD
        const fsd = new Uint8Array([t << 2 | ndims, 0, 0, 0, 0, 0, 0, 0]);
        for (let i = 0; i < ndims; i++) {
            fsd[2 + 2 * i] = (dims[i] >> 8) & 255;
            fsd[2 + 2 * i + 1] = dims[i] & 255;
        }
        return fsd;
    }

    private static getArrayType(array: TypedArray): number {
        // 0:Int8, 1:Uint8, 2:Int16, 3:Uint16, 4:Int32, 5:Uint32, 6:Float32, 7:Float64, 
        const types = ['Int8Array', 'Uint8Array', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array'];
        const typedArray = (ArrayBuffer.isView(array) && !(array instanceof DataView));
        return (typedArray ? types.indexOf(array.constructor.name) : -1);
    }

    // LFTTTTDD: 00011001 0x0 <len>(2) 0x0000 0x0000 [TTTT=6 Float32Array]
    public static float32Array(array: number[]): Blob {
        const data = Float32Array.from(array);
        return new Blob([FSF.d(data), data]);
    }

    // Раскодирует FSF-объекты, находящиеся в данном ArrayBuffer и возвращает массив JavaScript объектов им соотвествующих
    public static parseBuffer(buffer: ArrayBuffer): any[] {
        // return [{result:false, reason:'test error'}];
        const data = new Uint8Array(buffer);
        const parts = [];
        const fbuf = /** @type FSFbufType */({ data, offset: 0 });

        while (fbuf.offset < data.length) {
            const elem = data[fbuf.offset];
            const marker = elem & ~Const.FIN;

            if (marker === Const.PAD) { fbuf.offset++; } else if (marker === Const.OK) {   // после маркера OK идет нулевой байт
                parts.push({ result: true });
                fbuf.offset += 2;
            } else if (marker === Const.ERROR) {   // <FSF::ERROR><P><FSF::STRING>
                console.log('fbuf', fbuf);
                const errObj = { result: false, code: data[fbuf.offset + 1], reason: '' };    // да без проверки offset+1 на выход за границу
                fbuf.offset += 2; // <FSF::ERROR><P>
                errObj.reason = FSF.parseString(fbuf);
                parts.push(errObj);
                // console.log('errObj',errObj)
            } else if ((marker & ~Const.LONGIND) === Const.Uint8Arr) { parts.push(FSF.parseUint8Array(fbuf)); } else if ((marker & ~Const.LONGIND) === Const.Int32Arr) { parts.push(FSF.parseInt32Array(fbuf)); } else if ((marker & ~Const.LONGIND) === Const.Float32Arr) { parts.push(FSF.parseFloat32Array(fbuf)); } else if (marker === Const.FLOAT64) { parts.push(FSF.parseFloat64Array(fbuf)); } else if (marker === Const.BITMASK) { parts.push(FSF.parseBitMaskCube(fbuf)); } else if ((marker & ~Const.LONGIND) === Const.MASKWITHROI) { parts.push(FSF.parseMaskWithRoi(fbuf)); } else if ((marker & ~Const.LONGIND) === Const.BITMASKWITHROI) { parts.push(FSF.parseBitMaskWithRoi(fbuf)); } else {
                console.log('FSF: fbuf ', FSF.strBuffer(fbuf));     
                throw new Error('FSF: invalid marker ' + elem.toString(16));         
            }
        }
        return parts;
    }

    // 16-ричный дамп потока
    private static strBuffer(fsfbuf: FSFbufType): string {
        return FSF.hex(fsfbuf.data.subarray(fsfbuf.offset));
    }

    // Парсинг маркера FSF::BITMASKWITHROI - воксельная битовая маска куба c ROI если ROI = {0,0,0,0,0,0} и L=1 (zero ROI), то в кубе нет единиц
    private static parseBitMaskWithRoi(fsfbuf: FSFbufType): FSFProtoCube {
        const descSize = 20; // 2+dims[3]+ROI[6] = 20 байт
        const data = /** @type {Uint8Array} */(fsfbuf.data); const  offset = fsfbuf.offset;
        const L = (data[offset] & Const.LONGIND); const marker = (data[offset] & ~(Const.FIN | Const.LONGIND));
        if (marker !== Const.BITMASKWITHROI) { throw new Error('FSF: invalid BITMASKWITHROI marker'); }
        if (offset + descSize > data.length) { throw new Error('FSF: unsufficient buffer length'); }
        const n1 = data[offset + 2] * 256 + data[offset + 3];
        const n2 = data[offset + 4] * 256 + data[offset + 5];
        const n3 = data[offset + 6] * 256 + data[offset + 7];
        const r1 = data[offset + 8] * 256 + data[offset + 9];
        const r2 = data[offset + 10] * 256 + data[offset + 11];
        const r3 = data[offset + 12] * 256 + data[offset + 13];
        const r4 = data[offset + 14] * 256 + data[offset + 15];
        const r5 = data[offset + 16] * 256 + data[offset + 17];
        const r6 = data[offset + 18] * 256 + data[offset + 19];
        const roi = [r1, r2, r3, r4, r5, r6]; const zeroROI = L;   // это признак zero-ROI

        // куб ROI включает границы, это не dims, поэтому в вычислениях участвует +1
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        const roiSize = (zeroROI ? 0 : (r2 - r1 + 1) * (r4 - r3 + 1) * (r6 - r5 + 1));           // может сломаться с
        const off = roiSize % 8;
        const dataSize = ((roiSize - off) / 8 | 0) + (off > 0 ? 1 : 0);
        if (offset + descSize + dataSize > data.length) { throw new Error('FSF: unsufficient buffer length'); }

        const mask = new Uint8Array(data.buffer, offset + descSize, dataSize);
        dataSize === 0 &&  console.assert(mask.length === 0, 'mask should be zero-length Uint8Array ', mask);
      
        fsfbuf.offset += descSize + dataSize;

        return { dims: [n1, n2, n3], data: mask, maskType: Const.BITMASKWITHROI, ROI: roi };
    }

    // Парсинг маркера FSF::MASKWITHROI - воксельная маска куба c ROI
    private static parseMaskWithRoi(fsfbuf: FSFbufType): FSFProtoCube {
        const descSize = 20; // 2+dims[3]+ROI[6] = 20 байт
        const data = /** @type {Uint8Array} */(fsfbuf.data); const  offset = fsfbuf.offset;
        const L = (data[offset] & Const.LONGIND); const marker = (data[offset] & ~(Const.FIN | Const.LONGIND));
        if (marker !== Const.MASKWITHROI) { throw new Error('FSF: invalid MASKWITHROI marker'); }
        if (offset + descSize > data.length) { throw new Error('FSF: unsufficient buffer length'); }
        const n1 = data[offset + 2] * 256 + data[offset + 3];
        const n2 = data[offset + 4] * 256 + data[offset + 5];
        const n3 = data[offset + 6] * 256 + data[offset + 7];
        const r1 = data[offset + 8] * 256 + data[offset + 9];
        const r2 = data[offset + 10] * 256 + data[offset + 11];
        const r3 = data[offset + 12] * 256 + data[offset + 13];
        const r4 = data[offset + 14] * 256 + data[offset + 15];
        const r5 = data[offset + 16] * 256 + data[offset + 17];
        const r6 = data[offset + 18] * 256 + data[offset + 19];
        const roi = [r1, r2, r3, r4, r5, r6]; const zeroROI = L;   // это признак zero-ROI

        // куб ROI включает границы, это не dims, поэтому в вычислениях участвует +1
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        const dataSize = (zeroROI ? 0 : (r2 - r1 + 1) * (r4 - r3 + 1) * (r6 - r5 + 1));
        if (offset + descSize + dataSize > data.length) { throw new Error('FSF: unsufficient buffer length'); }

        const mask = new Uint8Array(data.buffer, offset + descSize, dataSize);
        dataSize === 0 &&  console.assert(mask.length === 0, 'mask should be zero-length Uint8Array ', mask);

        fsfbuf.offset += descSize + dataSize;

        return { dims: [n1, n2, n3], data: mask, maskType: Const.MASKWITHROI, ROI: roi };
    }

    //  Парсинг маркера FSF::BITMASK - воксельная маска куба, переданная как упакованный битовый массив
    private static parseBitMaskCube(fsfbuf: FSFbufType): FSFProtoCube {
        const descSize = 8;
        const data = /** @type {Uint8Array} */(fsfbuf.data); const  offset = fsfbuf.offset;
        if (data[offset] !== Const.BITMASK) { throw new Error('FSF: invalid BITMASK marker'); }
        if (offset + descSize > data.length) { throw new Error('FSF: unsufficient buffer length'); }
        const n1 = data[offset + 2] * 256 + data[offset + 3];
        const n2 = data[offset + 4] * 256 + data[offset + 5];
        const n3 = data[offset + 6] * 256 + data[offset + 7];
        const unpackedSize = n1 * n2 * n3; const packedSize = unpackedSize / 8;
        console.log('dims&packed size offset', n1, n2, n3, packedSize, offset);
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (unpackedSize % 8) { throw new Error('FSF::parseBitMaskCube воксельная маска должна иметь размер кратный 8'); }
        if (offset + descSize + packedSize > data.length) { throw new Error('FSF: unsufficient buffer length'); }
    
        const mask = new Uint8Array(data.buffer, offset + descSize, packedSize);
        fsfbuf.offset += descSize + packedSize;
    
        return { dims: [n1, n2, n3], data: mask, maskType: Const.BITMASK, ROI: [] };
    }

    // Парсинг маркера FSF::FLOAT64 (1-dim short index)
    private static parseFloat64Array(fsfbuf: FSFbufType): Float64Array {
        const descSize = 8;
        const data = /** @type {Uint8Array} */(fsfbuf.data); const  offset = fsfbuf.offset;
        if (data[offset] !== Const.FLOAT64) { throw new Error('FSF: invalid Float64Array marker'); }
        if (offset + descSize > data.length) { throw new Error('FSF: unsufficient buffer length'); }
        const n1 = data[offset + 2] * 256 + data[offset + 3];
        if (offset + descSize + n1 * 8 > data.length) { throw new Error('FSF: unsufficient buffer length'); } // 8 - размер double и Fload64
        const f64Array = new Float64Array(data.buffer, offset + descSize, n1); 
        fsfbuf.offset += descSize + n1 * 8;
        return f64Array;
    }

    // Парсинг маркера FSF::Float32Array (1-dim) Это третий случай, когда нужны длинные индексы (число вокселей на поверхности аорты Швец 94200)
    private static parseFloat32Array(fsfbuf: FSFbufType): Float32Array {
        const data = /** @type {Uint8Array} */(fsfbuf.data); const  offset = fsfbuf.offset;
        const L = (data[offset] & Const.LONGIND); const marker = (data[offset] & ~(Const.FIN | Const.LONGIND));
        if (marker !== Const.Float32Arr) { throw new Error('FSF: invalid Float32Array marker'); }
        // в коротком формате длина записана как uint16 без padding,
        // а в длинном формате как uint32 + 2 байта padding для выравнивания Int32Array на 4-ч байтовую границу
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        const dimLengthBytes = (L ? 6 : 2);
        if (offset + dimLengthBytes >= data.length) { throw new Error('FSF: unsufficient buffer length'); }
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        const dim0 = (L
            ? data[offset + 2] * 256 * 256 * 256 + data[offset + 3] * 256 * 256 + data[offset + 4] * 256 + data[offset + 5]
            : data[offset + 2] * 256 + data[offset + 3]);
        // console.log(' FSF.parseFloat32Array dim=',dim0)
        if (offset + dim0 + dimLengthBytes >= data.length) { throw new Error('FSF: unsufficient buffer length'); }
        fsfbuf.offset += 2 + dimLengthBytes + dim0 * 4;   // маркер == 2 байта + индекс
        return new Float32Array(data.buffer, offset + 2 + dimLengthBytes, dim0);
    }

    // Парсинг маркера FSF::Int32Array (1-dim) Это второй случай, когда нужны длинные индексы (число вокселей на поверхности аорты Швец 94200)
    private static parseInt32Array(fsfbuf: FSFbufType): Int32Array {
        const data = /** @type {Uint8Array} */(fsfbuf.data); const  offset = fsfbuf.offset;
        const L = (data[offset] & Const.LONGIND); const marker = (data[offset] & ~(Const.FIN | Const.LONGIND));
        if (marker !== Const.Int32Arr) { throw new Error('FSF: invalid Int32Array marker'); }
        // в коротком формате длина записана как uint16 без padding,
        // а в длинном формате как uint32 + 2 байта padding для выравнивания Int32Array на 4-ч байтовую границу
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        const dimLengthBytes = (L ? 6 : 2);
        if (offset + dimLengthBytes >= data.length) { throw new Error('FSF: unsufficient buffer length'); }
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        const dim0 = (L
            ? data[offset + 2] * 256 * 256 * 256 + data[offset + 3] * 256 * 256 + data[offset + 4] * 256 + data[offset + 5]
            : data[offset + 2] * 256 + data[offset + 3]);
        // console.log(' FSF.parseInt32Array dim=',dim0)
        if (offset + dim0 + dimLengthBytes >= data.length) { throw new Error('FSF: unsufficient buffer length'); }
        fsfbuf.offset += 2 + dimLengthBytes + dim0 * 4;   // маркер == 2 байта + индекс
        return new Int32Array(data.buffer, offset + 2 + dimLengthBytes, dim0);
    }
    
    // Парсинг маркера FSF::Uint8Array (1-dim) Это первый случай, когда задействуются длинные индексы (картинка среза аорты > 65К)
    private static parseUint8Array(fsfbuf: FSFbufType): Uint8Array {
        // console.log('FSF.parseUint8Array()')
        const data = /** @type {Uint8Array} */(fsfbuf.data); const  offset = fsfbuf.offset;
        const L = (data[offset] & Const.LONGIND); const marker = (data[offset] & ~(Const.FIN | Const.LONGIND));
        if (marker !== Const.Uint8Arr) { throw new Error('FSF: invalid Uint8Array marker'); }
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        const lengthBytes = (L ? 4 : 2);
        if (offset + lengthBytes >= data.length) { throw new Error('FSF: unsufficient buffer length'); }

        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        const len = (L
            ? data[offset + 2] * 256 * 256 * 256 + data[offset + 3] * 256 * 256 + data[offset + 4] * 256 + data[offset + 5]
            : data[offset + 2] * 256 + data[offset + 3]);
        // console.log(' FSF.parseUint8Array len=',len)
        if (offset + len + lengthBytes >= data.length) { throw new Error('FSF: unsufficient buffer length'); }
        fsfbuf.offset += len + 2 + lengthBytes;   // маркер == 2 байта + индекс
        return new Uint8Array(data.buffer, offset + 2 + lengthBytes, len);
    }

    // Парсинг маркера FSF::STRING
    private static parseString(fsfbuf: FSFbufType): string {
        const data = /** @type {Uint8Array} */(fsfbuf.data); const  offset = fsfbuf.offset;
        if (data[offset] !== Const.STRING) { throw new Error('FSF: invalid STRING marker'); }
        if (offset + 3 >= data.length) { throw new Error('FSF: unsufficient buffer length'); }
        const len = data[offset + 2] * 256 + data[offset + 3];
        if (offset + len + 4 > data.length) { throw new Error('FSF: unsufficient buffer length'); }
        fsfbuf.offset += len + 4;   // маркер == 4 байта
        return FSF.fromUTF8Array(data, offset + 4, len);
    }
    
    // Возвращает 16-ричную строку первых maxLen (default 16) байт в ArrayBuffer
    private static  hex(array: ArrayBuffer | Uint16Array, optMaxLen?: number): string {
        let nMax = 16;
        if (typeof optMaxLen !== 'undefined') { nMax = optMaxLen; }
        const n = (array instanceof Uint8Array ? array : new Uint8Array(array));
        if (nMax > n.length) nMax = n.length;
        let str = '';
        for (let i = 0; i < nMax; i++) { str += n[i].toString(16) + ' '; }
        return str;
    }

    // https://gist.github.com/joni/3760795
    private static fromUTF8Array(data: Uint8Array, offset: number, length: number): string {
        let str = '';
        // const i0 = (offset || 0);
        // const maxInd = i0 + (length || data.length);

        const i0 = offset;
        const maxInd = i0 + length;

        for (let i = i0; i < maxInd; i++) {
            const value = data[i];
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
                const charCode = ((value & 0x07) << 18 | (data[i + 1] & 0x3F) << 12 | (data[i + 2] & 0x3F) << 6 | data[i + 3] & 0x3F) - 0x010000;
                str += String.fromCharCode(charCode >> 10 | 0xD800, charCode & 0x03FF | 0xDC00); 
                i += 3;
            };
        }
        return str;
    }
}
export { FSF, type FSFProtoCube, Const as FSFCode };
