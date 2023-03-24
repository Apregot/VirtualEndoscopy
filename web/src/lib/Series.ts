import { type SeriesModel } from 'ami.js';

export class Series {
    private readonly seriesModel: SeriesModel;

    constructor(seriesModel: SeriesModel) {
        this.seriesModel = seriesModel;
    }

    getModel(): SeriesModel {
        return this.seriesModel;
    }
}
