import { type Stack } from 'ami.js';
import { FSF } from './FSF';

class FFRProtocol {
    private readonly wsready: boolean;
    private readonly ws: WebSocket;
    private readonly CMD: any;

    constructor(ws: WebSocket) {
        this.wsready = true;
        this.ws = ws;
        this.CMD = {
            LOAD_CUBE: 3,
            AortaSearch_FindAorta: 4,
            Initialize: 5,
            PrepareResult: 6
        };
    }

    /**
     * @legacy
     *
     * @param reqconsole.log(stack.ijk2LPS.elements);
     */
    async sendRequestReturningArrayBuffer(req: Blob): Promise<ArrayBuffer> {
        if (!this.wsready) throw Error('no connection to server');

        // это эксперименты с декодированием binary CMD -> string
        // работать то работает (если раскомментировать reqToString)
        // но GCC при компиляции очень сильно ругается поэтому ладно, пусть будет по старинке
        // console.log("sending on ffr-protocol: ", await this.reqToString(req))

        // TODO: вынести логирование таких вещей, как покрытие легаси кода, в отдельный класс Logger. Это позволит одним действием вырубать логирование для production сборок
        console.log('[OLD APPLICATION] sending on ffr-protocol (binary): ', req);

        return await new Promise((resolve, reject) => {
            this.ws.onmessage = (e) => { resolve(e.data); };
            this.ws.onerror = reject;
            this.ws.binaryType = 'arraybuffer';
            this.ws.send(req);
        });
    }

    /**
     * @legacy
     *
     * Функция ищет аорты после успешной загрузки данных на сервер
     *
     * @param numCircles
     * @param minRadius
     * @param maxRadius
     * @constructor
     */
    async AortaSearch_FindAorta(numCircles: number = 35, minRadius: number = 10, maxRadius: number = 2): Promise<ArrayBuffer> {
        const cmd = FSF.cmd(this.CMD.AortaSearch_FindAorta);

        // min и max радиусы по смыслу являются float, но в силу их приблизительности,
        // округление до int вполне допустимо, поэтому параметры передаются одним массивом
        //
        const params = FSF.array(new Uint16Array([numCircles, minRadius, maxRadius]));
        const b2 = new Blob([cmd, params]);
        // return this.sendRequestFSF(b2); // sendRequestFSF надо вообще убрать

        // TODO: вынести логирование таких вещей, как покрытие легаси кода, в отдельный класс Logger. Это позволит одним действием вырубать логирование для production сборок
        console.log('[OLD APPLICATION] sending on ffr-protocol: binary CMD AortaSearch_FindAorta');
        return await this.sendRequestReturningArrayBuffer(b2);
    }

    /**
     * @legacy
     *
     * @param stack передаваемый стек серии
     * @param func функция которая выполняется во время прогресса транспорта данных
     */
    async TransferCube(stack: Stack, func: any): Promise<any> {
        /* eslint-disable @typescript-eslint/naming-convention,  @typescript-eslint/restrict-plus-operands */

        console.log('TransferCube()');
        if (!this.wsready) throw Error('no connection to server');

        const slope = stack.rescaleSlope;
        const intercept = stack.rescaleIntercept;
        const needSlopeInterceptCalc = (slope !== 1 || intercept !== 0);

        return await new Promise((resolve, reject) => {
            this.ws.onmessage = (e) => { resolve(e.data); };
            this.ws.onerror = reject;
            console.log('[OLD APPLICATION] sending on ffr-protocol: binary CMD LOAD CUBE');
            const cmd = FSF.cmd(this.CMD.LOAD_CUBE);
            const cubeUID = new Uint8Array(32); cubeUID[0] = 255; // TBD: вычислить sha-256 хэш
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const fsfP0 = FSF.array(cubeUID);
            const fsfP1 = FSF.float32Array(stack.ijk2LPS.elements);
            const fsfP2 = FSF.float32Array(stack.lps2IJK.elements);
            const fsfP3 = FSF.float32Array([stack._spacing.x, stack._spacing.y, stack._spacing.z]);

            const dimsStack = [stack.dimensionsIJK.x, stack.dimensionsIJK.y, stack.dimensionsIJK.z];
            const fsdDicom = FSF.d(stack.frame[0].pixelData, dimsStack);

            // предполагается, что эти данные не фрагментируются вебсокером
            const b2 = new Blob([cmd, fsfP0, fsfP1, fsfP2, fsfP3, fsdDicom]);
            this.ws.send(b2);
            this.ws.onmessage = function(e) {
                // console.log('_ws.onmessage:test progress',e);
                if (e.data === 'fin') {
                    func('1 fin'); // 100%
                    resolve(e.data);
                } else { func(e.data); }
            };
            // передача фреймов стека DICOM может быть фрагментирована вебсокетом
            for (let z = 0; z < dimsStack[2]; z++) {
                let data = stack.frame[z].pixelData; // Int16Array
                if (needSlopeInterceptCalc) {
                    const copyData = data.slice();
                    for (let i = 0; i < data.length; i++) { copyData[i] = slope * data[i] + intercept; }
                    data = copyData;
                }
                this.ws.send(data);
            }
        });

        /* eslint-enable @typescript-eslint/naming-convention,  @typescript-eslint/restrict-plus-operands */
    }
}
export { FFRProtocol };
