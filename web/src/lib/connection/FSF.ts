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
}
export { FSF };
