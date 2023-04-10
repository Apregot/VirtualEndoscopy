import { type SeriesModel } from 'ami.js';
import { Patient } from './Patient';

export class Series {
    private readonly seriesModel: SeriesModel;
    private readonly patient: Patient;

    constructor(seriesModel: SeriesModel) {
        this.seriesModel = seriesModel;
        this.patient = new Patient(seriesModel);
    }

    getModel(): SeriesModel {
        return this.seriesModel;
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

    getSD(): string {
        return this.seriesModel.seriesDescription;
    }

    getNF(): number {
        return this.seriesModel.numberOfFrames;
    }
}
