import React, { type MutableRefObject, type ReactElement, useEffect, useRef, useState } from 'react';
import { type Stack } from 'ami.js';
import styles from './AortaSelect.module.scss';
import { BaseButton } from '../../../base/Button';
import * as THREE from 'three';

interface TProps {
    aortaSelectionProps: AortaSelectionProps
}

export interface AortaSelectionProps {
    stack: Stack
    imgBlob: Blob
    circles: Float64Array
}

export const AortaSelect = (props: TProps): ReactElement => {
    const img = URL.createObjectURL(props.aortaSelectionProps.imgBlob);
    const canvasRef = useRef(null);
    const [circle, selectCircle] = useState(-1);
    useEffect(() => {
        if (canvasRef === null) {
            return;
        }

        if (circle === -1 && props.aortaSelectionProps.circles.length !== 0) {
            selectCircle(0);
        }
    }, [canvasRef]);

    const drawCircle = (canvasRef: MutableRefObject<any>, circleIndex: number): void => {
        const circles = props.aortaSelectionProps.circles;
        const circlesCount = circles.length / 4;
        if (circlesCount === 0) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        context.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < circlesCount; i++) {
            const center = new THREE.Vector3(circles[4 * i], circles[4 * i + 1], circles[4 * i + 2]);
            const radius = circles[4 * i + 3];

            const ijkCenter = new THREE.Vector3().copy(center).applyMatrix4(props.aortaSelectionProps.stack.lps2IJK);

            const rr = new THREE.Vector3(center.x + radius, center.y, center.z);
            const rad = new THREE.Vector3().copy(rr).applyMatrix4(props.aortaSelectionProps.stack.lps2IJK);
            const ijkRadius = rad.x - ijkCenter.x;

            const centerX = Math.round(ijkCenter.x);
            const centerY = Math.round(ijkCenter.y);

            context.beginPath();
            context.arc(centerX, centerY, ijkRadius, 0, 2 * Math.PI, false);
            if (i === circle) {
                context.lineWidth = 3;
                context.setLineDash([]);
            } else {
                context.lineWidth = 2;
                context.setLineDash([5, 5]);
            }

            context.strokeStyle = 'red';
            context.stroke();
        }
    };

    useEffect(() => {
        if (circle === -1 || canvasRef === null) return;
        drawCircle(canvasRef, circle);
    }, [circle]);

    return (
        <div>
            <div className={styles.selectionWrapper}>
                <div className={styles.image}>
                    <img src={img} alt=""/>
                </div>
                <canvas ref={canvasRef} className={styles.canvas} width="512" height="512"></canvas>
            </div>
            <div className={styles.buttonPanel}>
                <BaseButton disabled={props.aortaSelectionProps.circles.length === 0} onClick={() => {}}>Принять</BaseButton>
                <BaseButton onClick={() => {}}>Отклонить</BaseButton>
                <BaseButton disabled={props.aortaSelectionProps.circles.length === 0} onClick={() => {}}>Указать другой центр аорты</BaseButton>
            </div>
        </div>
    );
};
