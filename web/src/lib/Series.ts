import { type SeriesModel } from 'ami.js';
import { Patient } from './Patient';
import { ROI } from './ROI';

export class Series {
    private readonly seriesModel: SeriesModel;
    private readonly patient: Patient;
    private readonly ROI: ROI;

    constructor(seriesModel: SeriesModel) {
        this.seriesModel = seriesModel;
        this.patient = new Patient(seriesModel);
        this.ROI = new ROI(seriesModel.stack[0]);
    }

    getModel(): SeriesModel {
        return this.seriesModel;
    }

    getROI(): ROI {
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

    getSeriesId(): string {
        return this.seriesModel.rawHeader.string('x0020000e');
    }

    getSD(): string {
        return this.seriesModel.seriesDescription;
    }

    getNF(): number {
        return this.seriesModel.numberOfFrames;
    }
}
