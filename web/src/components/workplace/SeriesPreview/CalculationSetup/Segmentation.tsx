import React, { type ChangeEvent, type ReactElement, useEffect, useState } from 'react';
import { BaseButton } from '../../../base/Button';
import { useAppSelector } from '../../../../hooks/redux';
import { Popup } from '../../../base/Popup';
import ProgressBar from 'react-bootstrap/ProgressBar';
import styles from './Segmentation.module.scss';
import * as THREE from 'three';
import { AortaSelect, type AortaSelectionProps } from './AortaSelect';

// @ts-expect-error unknown types
import { FFR__driver } from '../../../../lib/legacy';

export const Segmentation = (): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);
    const { webSocket } = useAppSelector((state) => state.webSocket);
    const [loadProgress, setLoadProgress] = useState(0);
    const [disabledFFR, setDisabledFFR] = useState(false);
    const [selectedAorta, setSelectedAorta] = useState<AortaSelectionProps | null>(null);

    const [ROI, setROI] = useState(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)));

    useEffect(() => {
        setDisabledFFR(webSocket === null);
    }, [webSocket]);
    useEffect(() => {
        if (selectedPreviewSeries !== null) {
            setROI(selectedPreviewSeries.getROI());
        }
    }, [selectedPreviewSeries]);

    const handleChange = (event: ChangeEvent): void => {

    };

    const initializeFFR = (): void => {
        if (selectedPreviewSeries === null) return;
        const driver = new FFR__driver(webSocket, selectedPreviewSeries.getModel());
        console.log('driver', driver);
        const p = new Promise(resolve => {
            driver.start(
                (val: any) => {
                    val = Number(val);
                    if (typeof val === 'number') {
                        setLoadProgress(val);
                    } 
                },
                (blob: Blob, circles: Float64Array) => {
                    setLoadProgress(0);
                    setSelectedAorta({
                        stack: selectedPreviewSeries.getModel().stack[0],
                        imgBlob: blob,
                        circles
                    });
                }
            );
        });
    };

    return (
        <div>
            {
                selectedAorta !== null
                    ? (
                        <Popup show={true} title={'Select Aorta'} onClose={() => {}}>
                            <AortaSelect aortaSelectionProps={selectedAorta}/>
                        </Popup>
                    )
                    : ''
            }

            {
                loadProgress > 0
                    ? (
                        <Popup onClose={() => { console.log('closed'); }} title={'Transfering DICOM data'} show={true}>
                            <div style={{ paddingBottom: '20px', width: '100%' }}>
                                {loadProgress < 100 ? 'Загрузка DICOM...' : 'DICOM успешно загружен! To be continued...'}
                                <ProgressBar animated now={loadProgress} label={`${loadProgress}%`} />
                            </div>
                        </Popup>
                    )
                    : ''
            }
            <div className={styles.title}>ROI для автосегментации</div>
            <div className={styles.inputs}>
                <div>
                    <label>Позиция (x, y, z)</label>
                    <div>
                        <input type="number" min="0" name="xStart" value={ROI.min.x} onChange={handleChange} />
                        <input type="number" min="0" name="yStart" value={ROI.min.y} onChange={handleChange} />
                        <input type="number" min="0" name="zStart" value={ROI.min.z} onChange={handleChange} />
                    </div>
                </div>
                <div>
                    <label>Размер (x, y, z)</label>
                    <div>
                        <input type="number" min="1" name="xEnd" value={ROI.max.x} onChange={handleChange} />
                        <input type="number" min="1" name="yEnd" value={ROI.max.y} onChange={handleChange} />
                        <input type="number" min="1" name="zEnd" value={ROI.max.z} onChange={handleChange} />
                    </div>
                </div>
                <div className={styles.buttons}>
                    <BaseButton onClick={() => {}}>Сбросить ROI</BaseButton>
                    <BaseButton disabled={disabledFFR} onClick={initializeFFR}>Initialize FFR processing</BaseButton>
                </div>
            </div>
        </div>
    );
};
