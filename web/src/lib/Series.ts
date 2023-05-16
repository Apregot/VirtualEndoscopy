import { type SeriesModel } from 'ami.js';
import { Patient } from './Patient';
import * as THREE from 'three';

export class Series {
    private readonly seriesModel: SeriesModel;
    private readonly patient: Patient;
    private readonly ROI: THREE.Box3;
    private readonly UID: string;

    constructor(seriesModel: SeriesModel) {
        this.seriesModel = seriesModel;
        this.patient = new Patient(seriesModel);
        this.ROI = new THREE.Box3(new THREE.Vector3(0, 0, 0), seriesModel.stack[0].dimensionsIJK.clone());
        this.UID = this.seriesModel.rawHeader.string('x00020003');
    }

    getModel(): SeriesModel {
        return this.seriesModel;
    }

    getROI(): THREE.Box3 {
        return this.ROI;
    }

    getPatient(): Patient {
        return this.patient;
    }

    getModality(): string {
        return this.seriesModel.modality;
    }

    getId(): string {
        return this.patient.id;
    }

    getSN(): string {
        return this.seriesModel.rawHeader.string('x00200011');
    }

    getPN(): string {
        return this.seriesModel.rawHeader.string('x00181030');
    }

    getUID(): string {
        return this.UID;
    }

    getSD(): string {
        return this.seriesModel.seriesDescription;
    }

    getNF(): number {
        return this.seriesModel.numberOfFrames;
    }

    setNF(frames: number): void {
        this.seriesModel.numberOfFrames = frames;
    }
}
