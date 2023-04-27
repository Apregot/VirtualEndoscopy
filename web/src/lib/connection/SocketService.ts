import { error } from 'three';

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

    // async sendRequestReturningArrayBuffer(req: any): Promise<any> {
    //     if (!this._wsready) return await Promise.reject('no connection to server');

    //     // это эксперименты с декодированием binary CMD -> string
    //     // работать то работает (если раскомментировать reqToString)
    //     // но GCC при компиляции очень сильно ругается поэтому ладно, пусть будет по старинке
    //     // console.log("sending on ffr-protocol: ", await this.reqToString(req)) 

    //     console.log('sending on ffr-protocol (binary): ', req);

    //     return await new Promise((resolve, reject) => {
    //         this._ws.onmessage = (e) => { resolve(e.data); };
    //         this._ws.onerror = reject;
    //         this._ws.binaryType = 'arraybuffer';
    //         this._ws.send(req);
    //     }); 
    // }

    // async AortaSearch_FindAorta(numCircles, minRadius, maxRadius) {
    //     numCircles = numCircles || 2;
    //     minRadius = minRadius || 10;
    //     maxRadius = maxRadius || 35;

    //     const cmd = FSF.CMD(this.CMD.AortaSearch_FindAorta);

    //     // min и max радиусы по смыслу являются float, но в силу их приблизительности,
    //     // округление до int вполне допустимо, поэтому параметры передаются одним массивом
    //     //
    //     const params = FSF.Array(new Uint16Array([numCircles, minRadius, maxRadius]));
    //     const b2 = new Blob([cmd, params]);
    //     // return this.sendRequestFSF(b2); // sendRequestFSF надо вообще убрать
    //     console.log('sending on ffr-protocol: binary CMD AortaSearch_FindAorta');
    //     return await this.sendRequestReturningArrayBuffer(b2);        
    // }

    // async TransferCube(stack: any, func: any): Promise<any> {
    //     // console.log('TransferCube()')
    //     if (!this._wsready) return await Promise.reject('no connection to server');
    //     const self = this;

    //     const slope = stack.rescaleSlope; const intercept = stack.rescaleIntercept;
    //     const needSlopeInterceptCalc = (slope != 1 || intercept != 0);
    //     // console.log('slope/intercept/needSlopeInterceptCalc',slope,intercept,needSlopeInterceptCalc)

    //     return await new Promise(function (resolve, reject) {
    //         self._ws.onmessage = (e) => { resolve(e.data); };
    //         self._ws.onerror = reject;
    //         console.log('sending on ffr-protocol: binary CMD LOAD CUBE');

    //         const cmd = FSF.CMD(self.CMD.LOAD_CUBE);
    //         const cube_UID = new Uint8Array(32); cube_UID[0] = 255; // TBD: вычислить sha-256 хэш
    //         const fsf_p0 = FSF.Array(cube_UID);
    //         const fsf_p1 = FSF.Float32Array(stack.ijk2LPS.elements);
    //         const fsf_p2 = FSF.Float32Array(stack.lps2IJK.elements);
    //         const fsf_p3 = FSF.Float32Array([stack._spacing.x, stack._spacing.y, stack._spacing.z]);

    //         const stack_dims = [stack.dimensionsIJK.x, stack.dimensionsIJK.y, stack.dimensionsIJK.z];
    //         const fsd_dicom = FSF.D(stack.frame[0].pixelData, stack_dims);

    //         // предполагается, что эти данные не фрагментируются вебсокером
    //         const b2 = new Blob([cmd, fsf_p0, fsf_p1, fsf_p2, fsf_p3, fsd_dicom]);
    //         self._ws.send(b2);
    //         self._ws.onmessage = function(e) {
    //             // console.log('_ws.onmessage:test progress',e);
    //             if (e.data === 'fin') {
    //                 func('1 fin'); // 100%
    //                 resolve(e.data);
    //             } else { func(e.data); }
    //         };
    //         // передача фреймов стека DICOM может быть фрагментирована вебсокетом
    //         for (let z = 0; z < stack_dims[2]; z++) {
    //             let data = stack.frame[z].pixelData; // Int16Array
    //             if (needSlopeInterceptCalc) {
    //                 const copyData = data.slice();
    //                 for (let i = 0; i < data.length; i++) { copyData[i] = slope * data[i] + intercept; }
    //                 data = copyData;
    //             }
    //             self._ws.send(data);
    //         }
    //     }); 
    // }    
}
export { SocketService };
