import React, { type ReactElement, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useAppSelector } from '../../../hooks/redux';
import styles from './QuadView.module.scss';

export const QuadView = (): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);

    let title = 'NONE SELECTED';
    if (selectedPreviewSeries !== null) {
        title = `selected ${selectedPreviewSeries.getId()}`;
        console.log(`${title} was selected`);
        const seriesStack = selectedPreviewSeries.getModel().stack[0];

        // old_www/js/ui/components/quadview.js:162 , загрузка серии в фреймы. Следует разобраться и добавить типы
        // old_www/js/ui/components/quadview.js:107 начинать ресерч от сюда
        const RIO = new THREE.Box3(new THREE.Vector3(0, 0, 0), seriesStack.dimensionsIJK.clone());
        console.log(RIO);
    }
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current === null) {
            return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });

        const geometry = new THREE.PlaneGeometry(5, 5);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(geometry, material);
        scene.add(plane);

        camera.position.z = 5;

        function animate(): void {
            requestAnimationFrame(animate);

            // Добавляем вращение плоскости
            plane.rotation.x += 0.01;
            plane.rotation.y += 0.01;

            renderer.render(scene, camera);
        }

        animate();
    }, [canvasRef]);

    return (
        <div className={styles.wrapper}>
            <div className={`${styles.renderer} ${styles.red}`}><canvas style={{ width: '100%', height: '100%' }} ref={canvasRef} /></div>
            <div className={`${styles.renderer} ${styles.blue}`}></div>
            <div className={`${styles.renderer} ${styles.yellow}`}></div>
            <div className={`${styles.renderer} ${styles.green}`}></div>
        </div>
    );
};
