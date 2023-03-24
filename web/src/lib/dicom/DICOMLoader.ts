import FileVolumeLoader from './FileVolumeLoader';
import { type SeriesModel } from 'ami.js';

export default class DICOMLoader {
    static async loadSeries(files: File | FileList): Promise<SeriesModel> {
        return await DICOMLoader.loadLocalFiles(files);
    }

    private static async loadLocalFiles(files: File | FileList): Promise<SeriesModel> {
        const loader = new FileVolumeLoader();
        await loader.load(files);

        const series = loader.data[0].mergeSeries(loader.data)[0];
        const stack = series.stack[0];
        stack.prepare();
        return series;
    }
}
