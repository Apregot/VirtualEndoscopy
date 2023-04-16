import * as THREE from 'three';
import * as AMI from 'ami.js';
import { type WebGLRenderer } from 'three/src/renderers/WebGLRenderer';

export interface ThreeFrame {
    id: string // Имя в системе UP3
    domId?: string
    domElement: HTMLElement | null // HTMLElement
    renderer?: WebGLRenderer
    color: number
    targetID: number
    camera: any
    controls: any
    scene?: THREE.Scene
    light: any
    stackHelper: any
    dicomInfo: any // ссылка на объект класса DicomInfo
    boxHelper: any // надо для dispose
    stack: any
    render: any

    sliceColor: number
    sliceOrientation: string

    // true, если для данного элемента работает стандартная UP.render()
    // при внешнем рендеринге этот флаг должен выставляться вручную
    rendered: boolean
    // этот флаг разрешает стандартный UP3.render()
    enabledStandardRendering: boolean

    // вторая сцена и камера используется PlasticBoy для рендеринга LUT
    scene2: any
    camera2: any
    light2: any // light2 добавляется к scene2 самим PlasticBoy
}

/**
 * Класс для работы с библиотекой THREE.js
 * Его старший брат: old_www/js/up3.js
 *
 * По первому взгляду на логику существующего кода - этот класс является фасадом над библиотекой THREE.js
 * Думаю что стоит подойти к ГВ для уточнения деталей работы предка
 */
export class UP3 {
    /** Массив активных фреймов threejs */
    private static readonly data: ThreeFrame[] = [];

    static enable(element: ThreeFrameElement): ThreeFrame {
        let threeElement = UP3.getEnabledElement(element);
        if (threeElement === null) {
            UP3.data.push(UP3.create());
            threeElement = UP3.data[UP3.data.length - 1];
            if (typeof element === 'string') {
                threeElement.id = element;
                const domElement = document.getElementById(element);
                if (domElement == null) {
                    throw new Error(`Cannot find domElement with id ${element}`);
                }

                threeElement.domElement = domElement;
            } else {
                threeElement.domElement = element;
                threeElement.id = element.id;
            }
        }

        return threeElement;
    }

    static getEnabledElement(element: ThreeFrameElement, mustExists: boolean = false): ThreeFrame | null {
        const frameProp = (typeof element === 'string' ? 'id' : 'domElement');
        for (const frame of UP3.data) {
            if (frame[frameProp] === element) {
                return frame;
            }
        }

        if (mustExists) {
            throw new Error(`getEnabledElement: can not find element ${frameProp}`);
        }

        return null;
    }

    static initRenderer2D(element: ThreeFrameElement): void {
        const rendererObject = UP3.getEnabledElement(element, true);
        if (rendererObject === null || rendererObject.domElement == null) {
            return;
        }

        /* renderer */
        rendererObject.renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererObject.renderer.autoClear = false;
        rendererObject.renderer.localClippingEnabled = true;
        rendererObject.renderer.setSize(rendererObject.domElement.clientWidth, rendererObject.domElement.clientHeight);
        rendererObject.renderer.setClearColor(0x121212, 1);
        rendererObject.renderer.domElement.id = String(rendererObject.targetID);
        rendererObject.domElement.appendChild(rendererObject.renderer.domElement);

        /* camera */
        rendererObject.camera = new AMI.OrthographicCamera(
            rendererObject.domElement.clientWidth / -2,
            rendererObject.domElement.clientWidth / 2,
            rendererObject.domElement.clientHeight / 2,
            rendererObject.domElement.clientHeight / -2,
            1,
            1000
        );

        /* controls */
        rendererObject.controls = new AMI.TrackballOrthoControl(rendererObject.camera, rendererObject.domElement);
        rendererObject.controls.staticMoving = true;
        rendererObject.controls.noRotate = true;
        rendererObject.camera.controls = rendererObject.controls;

        rendererObject.scene = new THREE.Scene();
    }

    static initHelpersStack(frame: ThreeFrame, stack: any): void {

    }

    static create(): ThreeFrame {
        return {
            id: '',
            domId: undefined,
            domElement: null,
            color: 0x212121,
            targetID: 0,
            camera: null,
            controls: null,
            light: null,
            stackHelper: null,
            dicomInfo: null,
            boxHelper: null,
            stack: null,
            render: null,
            rendered: false,
            enabledStandardRendering: true,
            scene2: null,
            camera2: null,
            light2: null,
            sliceColor: 0x000000,
            sliceOrientation: 'axis'
        };
    };
}

type ThreeFrameElement = string | HTMLElement;
