import React, { type ReactElement, useEffect, useRef } from 'react';
import { type AortaView, type ThreeFrame, UP3 } from '../../../lib/visualization';
import { AortaConfig } from './AortaConfig';
import { useAppSelector } from '../../../hooks/redux';
import { FFRController } from '../../../lib/connection/FFRController';
import { FSF } from '../../../lib/connection/FSF';
import { Cube } from '../../../lib/visualization';
import * as THREE from 'three';

interface TProps {
    aortaView: AortaView
}

export const AortaPreview = (props: TProps): ReactElement => {
    const previewRef = useRef(null);
    const { webSocket } = useAppSelector((state) => state.webSocket);
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);
    useEffect(() => {
        if (previewRef === null || previewRef.current === null) return;

        const previewFrame = previewRef.current;
        const visual = UP3.enable(previewFrame);
        UP3.initRenderer3D(previewFrame);
        UP3.render(previewFrame);
        void (new Promise((resolve, reject) => { rerender(visual).catch((error: any) => { console.error('rerender error: ', error); }); resolve(true); }));
    }, [previewRef]);

    const rerender = async (el: ThreeFrame): Promise<void> => {
        if (webSocket === null || selectedPreviewSeries === null || el.controls === null) return;

        const scene = el.scene;
        const camera = el.camera;
        if (scene === null || camera === null) return;

        const controller = new FFRController(webSocket, selectedPreviewSeries.getModel());
        const data = await controller.loadAortaPreview(props.aortaView.tau);
        const obj = FSF.parseBuffer(data);
        const aortaCube = new Cube(obj[0], 'aorta');
        const aortaPreviewGeometry = aortaCube.geometry();
        const aortaPreviewMesh = new THREE.Mesh(aortaPreviewGeometry, new THREE.MeshLambertMaterial({ color: 0x00fafa, side: THREE.DoubleSide }));
        scene.add(aortaPreviewMesh);
        const centerLPS = aortaPreviewGeometry.boundingBox?.getCenter(new THREE.Vector3(150, 150, 150));
        if (centerLPS === undefined) return;
        const camPos = new THREE.Vector3().addVectors(centerLPS, new THREE.Vector3(150, 150, 150));
        camera.position.set(camPos.x, camPos.y, camPos.z);
        camera.lookAt(centerLPS.x, centerLPS.y, centerLPS.z);
        el.controls.target.set(centerLPS.x, centerLPS.y, centerLPS.z);
        console.log('added aortaPreviewMesh');
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <AortaConfig aorta={props.aortaView} onTauChange={(tau) => { console.log('changed', tau); }}/>
            <div style={{ width: '100%', height: '100%' }} ref={previewRef}></div>
        </div>
    );
};
