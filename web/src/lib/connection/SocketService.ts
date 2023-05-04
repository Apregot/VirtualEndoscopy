
// @ts-expect-error legacy support
import { FSF } from '../legacy';

class SocketService {
    private readonly _wsurl: string;
    private _wsready: boolean;
    private readonly _ws: WebSocket;
    private readonly CMD: any;

    constructor(wsurl: string) {
        this._wsurl = wsurl;
        this._wsready = false;
        this._ws = new WebSocket(wsurl, 'ffr-protocol');
        this._ws.onopen = () => { console.log('connected'); this._wsready = true; };
        this._ws.onclose = () => { console.log('disconnected'); this._wsready = true; };
        this._ws.onerror = function() { console.log('error'); };
        this.CMD = {
            LOAD_CUBE: 3,
            AortaSearch_FindAorta: 4,
            Initialize: 5,
            PrepareResult: 6
        };
    }

    addEventListener(event: string, func: any): void {
        if (event === 'close') { this._ws.addEventListener('close', func); } else if (event === 'ready') { this._ws.addEventListener('open', func); }
    }

    isReady(): boolean { return this._wsready; }

    disconnect(): void {
        this._ws.close();
    }
    
    async sendRequest(req: any): Promise<any> {
        // eslint-disable-next-line prefer-promise-reject-errors
        if (!this._wsready) return await Promise.reject('no connection to server');
        return await new Promise((resolve, reject) => {
            this._ws.onmessage = (e) => { resolve(e.data); };
            this._ws.onerror = reject;
            console.log('sending on ffr-protocol: ', req);
            this._ws.binaryType = 'blob';
            this._ws.send(req);
        });
    }

    version(): void { this.sendRequest('version').then(value => { console.log('version: ', value); }).catch(error => { console.log('error: ', error); }); }

    /**
     * @legacy
     *
     * @param req
     */
    async sendRequestReturningArrayBuffer(req: Blob): Promise<ArrayBuffer> {
        if (!this._wsready) throw Error('no connection to server');

        // это эксперименты с декодированием binary CMD -> string
        // работать то работает (если раскомментировать reqToString)
        // но GCC при компиляции очень сильно ругается поэтому ладно, пусть будет по старинке
        // console.log("sending on ffr-protocol: ", await this.reqToString(req))

        // TODO: вынести логирование таких вещей, как покрытие легаси кода, в отдельный класс Logger. Это позволит одним действием вырубать логирование для production сборок
        console.log('[OLD APPLICATION] sending on ffr-protocol (binary): ', req);

        return await new Promise((resolve, reject) => {
            this._ws.onmessage = (e) => { resolve(e.data); };
            this._ws.onerror = reject;
            this._ws.binaryType = 'arraybuffer';
            this._ws.send(req);
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
    async AortaSearch_FindAorta(numCircles = 35, minRadius = 10, maxRadius = 2): Promise<ArrayBuffer> {
        const cmd = FSF.CMD(this.CMD.AortaSearch_FindAorta);

        // min и max радиусы по смыслу являются float, но в силу их приблизительности,
        // округление до int вполне допустимо, поэтому параметры передаются одним массивом
        //
        const params = FSF.Array(new Uint16Array([numCircles, minRadius, maxRadius]));
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
    async TransferCube(stack: any, func: any): Promise<any> {
        /* eslint-disable @typescript-eslint/naming-convention,  @typescript-eslint/restrict-plus-operands */

        console.log('TransferCube()');
        if (!this._wsready) throw Error('no connection to server');

        const slope = stack.rescaleSlope; const intercept = stack.rescaleIntercept;
        const needSlopeInterceptCalc = (slope !== 1 || intercept !== 0);

        return await new Promise((resolve, reject) => {
            this._ws.onmessage = (e) => { resolve(e.data); };
            this._ws.onerror = reject;
            console.log('[OLD APPLICATION] sending on ffr-protocol: binary CMD LOAD CUBE');

            const cmd = FSF.CMD(this.CMD.LOAD_CUBE);
            const cube_UID = new Uint8Array(32); cube_UID[0] = 255; // TBD: вычислить sha-256 хэш
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const fsf_p0 = FSF.Array(cube_UID);
            const fsf_p1 = FSF.Float32Array(stack.ijk2LPS.elements);
            const fsf_p2 = FSF.Float32Array(stack.lps2IJK.elements);
            const fsf_p3 = FSF.Float32Array([stack._spacing.x, stack._spacing.y, stack._spacing.z]);

            const stack_dims = [stack.dimensionsIJK.x, stack.dimensionsIJK.y, stack.dimensionsIJK.z];
            const fsd_dicom = FSF.D(stack.frame[0].pixelData, stack_dims);

            // предполагается, что эти данные не фрагментируются вебсокером
            const b2 = new Blob([cmd, fsf_p0, fsf_p1, fsf_p2, fsf_p3, fsd_dicom]);
            this._ws.send(b2);
            this._ws.onmessage = function(e) {
                // console.log('_ws.onmessage:test progress',e);
                if (e.data === 'fin') {
                    func('1 fin'); // 100%
                    resolve(e.data);
                } else { func(e.data); }
            };
            // передача фреймов стека DICOM может быть фрагментирована вебсокетом
            for (let z = 0; z < stack_dims[2]; z++) {
                let data = stack.frame[z].pixelData; // Int16Array
                if (needSlopeInterceptCalc) {
                    const copyData = data.slice();
                    for (let i = 0; i < data.length; i++) { copyData[i] = slope * data[i] + intercept; }
                    data = copyData;
                }
                this._ws.send(data);
            }
        });

        /* eslint-enable @typescript-eslint/naming-convention,  @typescript-eslint/restrict-plus-operands */
    }
}
export { SocketService };
