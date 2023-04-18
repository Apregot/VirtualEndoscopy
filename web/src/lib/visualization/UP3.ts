import * as THREE from 'three';
import * as AMI from 'ami.js';
import { type WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { type Stack } from 'ami.js';
import { type Object3D } from 'three';

export interface ThreeFrame {
    id: string // Имя в системе UP3
    domId?: string
    domElement: HTMLElement | null // HTMLElement
    renderer: WebGLRenderer | null
    color: number
    targetID: number

    camera: AMI.OrthographicCamera | null
    controls: AMI.TrackballOrthoControl | null

    scene: THREE.Scene | null
    light: any
    stackHelper: AMI.StackHelper | null
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
        rendererObject.renderer.setSize(128, 128);
        rendererObject.renderer.setClearColor(0x121212, 1);
        rendererObject.renderer.domElement.id = String(rendererObject.targetID);
        rendererObject.domElement.appendChild(rendererObject.renderer.domElement);

        /* camera */
        const OrthographicCamera = AMI.orthographicCameraFactory(THREE);
        // rendererObject.camera = new OrthographicCamera(
        //     rendererObject.domElement.clientWidth / -2,
        //     rendererObject.domElement.clientWidth / 2,
        //     rendererObject.domElement.clientHeight / 2,
        //     rendererObject.domElement.clientHeight / -2,
        //     1,
        //     1000
        // );
        rendererObject.camera = new OrthographicCamera(
            128 / -2,
            128 / 2,
            128 / 2,
            128 / -2,
            1,
            1000
        );

        /* controls */
        const TrackballOrthoControl = AMI.trackballOrthoControlFactory(THREE);
        rendererObject.controls = new TrackballOrthoControl(rendererObject.camera, rendererObject.domElement);
        if (rendererObject.controls === null || (rendererObject.camera === null)) return;
        rendererObject.controls.staticMoving = true;
        rendererObject.controls.noRotate = true;
        rendererObject.camera.controls = rendererObject.controls;

        rendererObject.scene = new THREE.Scene();
    }

    static initHelpersStack(frame: ThreeFrame, stack: Stack): void {
        const StackHelper = AMI.stackHelperFactory(THREE);
        frame.stackHelper = new StackHelper(stack);
        if (frame.stackHelper === null) return;
        frame.stackHelper.bbox.visible = false;
        frame.stackHelper.borderColor = frame.sliceColor;
        frame.stackHelper.canvasWidth = 128;
        frame.stackHelper.canvasHeight = 128;

        // set camera
        const worldbb = stack.worldBoundingBox();
        const lpsDims = new THREE.Vector3(
            (worldbb[1] - worldbb[0]) / 2,
            (worldbb[3] - worldbb[2]) / 2,
            (worldbb[5] - worldbb[4]) / 2
        );

        // box: {halfDimensions, center}
        const box = {
            center: stack.worldCenter().clone(),
            halfDimensions: new THREE.Vector3(lpsDims.x + 10, lpsDims.y + 10, lpsDims.z + 10)
        };

        // init and zoom
        const canvas = {
            width: 128,
            height: 128
        };

        if (frame.camera === null || frame.scene === null) return;

        frame.camera.directions = [stack.xCosine, stack.yCosine, stack.zCosine];
        frame.camera.box = box;
        frame.camera.canvas = canvas;
        frame.camera.orientation = frame.sliceOrientation;
        frame.camera.update();
        frame.camera.fitBox(1, 2);

        frame.stackHelper.orientation = frame.camera.stackOrientation;
        frame.stackHelper.index = Math.floor(frame.stackHelper.orientationMaxIndex / 2);
        frame.scene.add(frame.stackHelper as Object3D);
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
            sliceOrientation: 'axis',
            stackHelper: null,
            renderer: null,
            scene: null
        };
    };
}

type ThreeFrameElement = string | HTMLElement;
