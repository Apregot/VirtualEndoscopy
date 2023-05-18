import { type SeriesModel, type Stack } from 'ami.js';
import { FSF } from './FSF';
import { FFRProtocol } from './FFRProtocol';
import { type SocketService } from './SocketService';
import type * as THREE from 'three';
import { type AortaView } from '../visualization';

/** Класс FFRController отвечает за взаимодействие с удаленным FFR-сервером, реализует запуск
 * диалогов и взаимодействие с QuadView в процессе обработки стеноза вплоть до запуска blood.
 * FFRController это класс сценария обработки, то есть главный дирижер, который координирует UI и вызовы методов serverInterface 
 * Ниже serverInterface это технический класс доступа к серверу FFR, он знает протокол и т.д.
*/

// FFRController: в этом варианте реализует сценарий Почукаева-113 (много хардкода пока)  
//
class FFRController {
    private readonly ffrp: FFRProtocol;
    private readonly series: SeriesModel;
    private readonly stack: Stack;
    private readonly progressBar: number | null;
    private readonly aortaPreviewState: any; // тип D10StateType
    private readonly vesselMesh: any;
    private readonly visArea: any;
    private readonly aortaPreviewMesh: any;
    private readonly vesselsThreshold: number;

    constructor (ws: SocketService, series: SeriesModel) {
        this.ffrp = new FFRProtocol(ws.getWebSocket());
        this.series = series;
        this.stack = series.stack[0]; // this.stack.frame.reverse(); // для Томск
        this.progressBar = null;
        this.aortaPreviewState = ({ tau: 0.09, alpha: 0.5, beta: 0.5, gamma: 500, mesh: null });
        this.vesselMesh = null;
        this.visArea = null;
        this.aortaPreviewMesh = null;
        this.vesselsThreshold = 20;
    }

    async start(onLoadingProgress: any, selectAorta: any): Promise<void> {
        console.log('FFRController::start()');
        // здесь надо организовать запуск ATB, подключение по вебсокету, запрос фото аорты и тогда вызывать Dialog-8
        // нет подключение обеспечивает верхний уровень, передавая сюда уже подключенный serverInterface
        // задача FFRController - скоординировать вызовы диалогов и FFR сервера
        // TBD: Dialog-8 или FFRController? должен взаимодействовать с сервером

        await this.ffrp.TransferCube(this.stack, (msg: string) => {
            const part = msg.split(' ');
            if (part.length > 1) {
                const persent = (parseFloat(part[0]) * 100).toFixed(1);
                part.shift();
                const what = part.join(' ');
                if (what === 'fin') {
                    onLoadingProgress(100);
                } else {
                    onLoadingProgress(persent);
                }
            }
        });

        const retAortaSearch = await this.ffrp.AortaSearch_FindAorta();
        // console.log('retAortaSearch=',hex(retAortaSearch,32));

        // AortaSearch_FindAorta возвращает ArrayBuffer в котором находится либо <FSF::ERROR> 
        // либо <FSF::OK><FSF::Uint8Array=Blob('image/png')><FSF::Float32Array[4]={Center[3],radius}>
        // то, что заключено в угловые скобки <> передается как объекты FSF в ArrayBuffer

        const searchResult = FSF.parseBuffer(retAortaSearch);
        // console.log('searchResult',searchResult);
        const resp = searchResult[0]; // это либо OK либо ERR
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (!resp.result) {
            console.log('AortaSearchError', resp);
        } else {
            console.log('Success AourtaSearch: ', searchResult);
            selectAorta(new Blob([searchResult[1]], { type: 'image/png' }), searchResult[2]);
        }
    }

    async initializeAndSegmentAorta(center: THREE.Vector3, radius: number, onLoad: (proc: number) => void): Promise<AortaView> {
        const x = Number(center.x.toFixed(2));
        const y = Number(center.y.toFixed(2));
        const z = Number(center.z.toFixed(2));
        const r = Number(radius.toFixed(2));

        await this.ffrp.Initialize(x, y, z, r);
        await this.ffrp.PrepareAortaProc(onLoad);

        const getOptimalTau = async (): Promise<number> => {
            return await this.ffrp.sendRequest('GetOptimalTau');
        };
        const defaultAorta = { tau: 0.09, alpha: 0.5, beta: 0.5, gamma: 500, mesh: null };
        const optimalTau = await getOptimalTau();
        if (optimalTau > 0) {
            defaultAorta.tau = optimalTau;
        }

        return defaultAorta;
    }
}
export { FFRController };
