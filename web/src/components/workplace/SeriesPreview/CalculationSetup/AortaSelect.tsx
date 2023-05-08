import React, { type MutableRefObject, type ReactElement, useEffect, useRef, useState } from 'react';
import { type Stack } from 'ami.js';
import styles from './AortaSelect.module.scss';
import { BaseButton } from '../../../base/Button';
import * as THREE from 'three';
import { HTMLElementHelper } from '../../../../lib/utils';

interface TProps {
    aortaSelectionProps: AortaSelectionProps
    onAccept: (selectedCircle: number) => void
    onReject: () => void
}

export interface AortaSelectionProps {
    stack: Stack
    imgBlob: Blob
    circles: Float64Array
}

export const AortaSelect = (props: TProps): ReactElement => {
    const img = URL.createObjectURL(props.aortaSelectionProps.imgBlob);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [circle, selectCircle] = useState(-1);
    const [centerIsChanging, setCenterChanging] = useState(false);
    const [IJKCenter, setIJKCenter] = useState<THREE.Vector3 | null>(null);
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

            const currentIJKCenter = new THREE.Vector3().copy(center).applyMatrix4(props.aortaSelectionProps.stack.lps2IJK);
            setIJKCenter(currentIJKCenter);

            const rad = (new THREE.Vector3(center.x + radius, center.y, center.z)).applyMatrix4(props.aortaSelectionProps.stack.lps2IJK);
            const ijkRadius = rad.x - currentIJKCenter.x;

            const centerX = Math.round(currentIJKCenter.x);
            const centerY = Math.round(currentIJKCenter.y);

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

    const onCenterChangeInit = (): void => {
        if (canvasRef === null || canvasRef.current === null) return;
        setCenterChanging(true);
        const circles = props.aortaSelectionProps.circles;
        const canvas = canvasRef.current;
        if (!(canvas instanceof HTMLElement)) {
            return;
        }
        canvas.style.cursor = 'crosshair';

        const stack = props.aortaSelectionProps.stack;

        const canvasOffset = HTMLElementHelper.getOffsetRect(canvas);
        canvas.addEventListener('mousedown', event => {
            if (IJKCenter === null) return;

            const x = event.clientX - canvasOffset.left;
            const y = event.clientY - canvasOffset.top;

            const posClick = new THREE.Vector3(x, y, IJKCenter.z).applyMatrix4(stack.ijk2LPS);

            const numCircles = circles.length / 4;
            for (let i = 0; i < numCircles; i++) {
                const center = new THREE.Vector3(circles[4 * i], circles[4 * i + 1], circles[4 * i + 2]); const radius = circles[4 * i + 3];
                if (center.distanceToSquared(posClick) <= radius * radius) {
                    console.log(`попали в ${i + 1} круг`);
                    selectCircle(i);
                    break;
                }
            }
        });
    };

    return (
        <div>
            <div className={styles.selectionWrapper}>
                <div className={styles.image}>
                    <img src={img} alt=""/>
                </div>
                <canvas ref={canvasRef} className={styles.canvas} width="512" height="512"></canvas>
            </div>
            <div className={styles.buttonPanel}>
                <BaseButton disabled={props.aortaSelectionProps.circles.length === 0} onClick={() => { props.onAccept(circle); }}>Принять</BaseButton>
                <BaseButton onClick={() => { props.onReject(); }}>Отклонить</BaseButton>
                <BaseButton disabled={props.aortaSelectionProps.circles.length === 0 || centerIsChanging} onClick={() => { onCenterChangeInit(); }}>Указать другой центр аорты</BaseButton>
            </div>
        </div>
    );
};
