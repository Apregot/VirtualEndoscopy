/**
 * Декларация типов необходимых инструментов из библиотеки AMI v0.22
 * Пока типы определены навскидку, требуется произвести дебаг дабы определить что за данные там лежат
 *
 * Все используемые типы из старой программы:
 * @see old_www/js/ami.ext.js
 */
declare module 'ami.js' {
    import type * as THREE from 'three';
    import { Camera, type Matrix4, Object3D } from 'three';

    export class SeriesModel {
        seriesInstanceUID: string;
        studyInstanceUID: string;
        transferSyntaxUID: string;
        rawHeader: RawHeader;
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

    export class StackHelper extends Object3D {
        constructor(stack: Stack);

        index: number;

        bbox: HelpersBoundingBox;
        slice: HelpersSlice;
        border: HelpersSlice;

        orientation: number;
        outOfBounds: number;

        orientationMaxIndex: number;
        orientationSpacing: number;

        canvasWidth: number;
        canvasHeight: number;
        borderColor: number;
    }

    export class HelpersSlice {
        canvasWidth: number;
        canvasHeight: number;
    }

    export class HelpersBoundingBox {
        visible: boolean;
    }

    export class RawHeader {
        string: (val: string) => string;
    }

    export class VolumeLoader {
        loadSequence: (file: File, requests: Map<any, any>) => Promise;
        loadSequenceGroup: (files: File[], requests: Map<any, any>) => Promise[];
        data: ModelsSeries[];
    }

    export class ModelsSeries {
        mergeSeries: (series: ModelSeries[]) => SeriesModel[];
    }

    class Coord {
        x: number;
        y: number;
        z: number;
    }

    class ModuleFrame {
        pixelData: Int16Array;
    }

    export class Stack {
        xCosine: number;
        yCosine: number;
        zCosine: number;
        dimensionsIJK: Coord; // было Dimensions, надо поправить, если сломается
        lps2IJK: Matrix4;
        ijk2LPS: Matrix4;
        rescaleSlope: number;
        rescaleIntercept: number;
        frame: ModuleFrame[];

        prepare: () => void;
        worldBoundingBox: () => [number, number, number, number, number, number];
        worldCenter: () => THREE.Vector3;

        _numberOfFrames: number;
        _rows: number;
        _columns: number;
        _spacing: Coord;
    }

    export class Dimensions {
        clone: () => THREE.Vector3;
    }

    export class OrthographicCamera extends Camera {
        constructor(left: number, right: number, top: number, bottom: number, near: number, far: number);

        controls: any;
        box: { center: THREE.Vector3, halfDimensions: THREE.Vector3 };
        canvas: { width: number, height: number };
        orientation: string;
        stackOrientation: number;

        update(): void;
        fitBox(a: number, b: number): void;
        directions: number[3];
    }

    export class TrackballOrthoControl {
        constructor(camera: OrthographicCamera, element: HTMLElement);
        staticMoving: boolean;
        noRotate: boolean;
    }

    /* Factory Section */
    function orthographicCameraFactory(three: THREE): OrthographicCamera.prototype;
    function stackHelperFactory(three: THREE): StackHelper.prototype;
    function trackballOrthoControlFactory(three: THREE): TrackballOrthoControl.prototype;
}
