/**
 * Декларация типов необходимых инструментов из библиотеки AMI v0.22
 * Пока типы определены навскидку, требуется произвести дебаг дабы определить что за данные там лежат
 *
 * Все используемые типы из старой программы:
 * @see old_www/js/ami.ext.js
 */
declare module 'ami.js' {
    export class SeriesModel {
        seriesInstanceUID: string;
        studyInstanceUID: string;
        transferSyntaxUID: string;
        rawHeader: any[];
        seriesDate: string;
        seriesDescription: string;
        modality: string;

        patientID: string;
        patientName: string;
        patientAge: string;
        patientBirthdate: string;
        patientSex: string;

        stack: Stack[];

        numberOfFrames: number;
        numberOfChannels: number;
    }

    export class VolumeLoader {
        loadSequence: (file: File, requests: Map<any, any>) => Promise;
        loadSequenceGroup: (files: File[], requests: Map<any, any>) => Promise[];
        data: ModelsSeries[];
    }

    export class ModelsSeries {
        mergeSeries: (series: ModelSeries[]) => SeriesModel[];
    }

    export class Stack {
        xCosine: number;
        yCosine: number;
        zCosine: number;
        dimensionsIJK: Object;
        prepare: () => void;
    }
}
