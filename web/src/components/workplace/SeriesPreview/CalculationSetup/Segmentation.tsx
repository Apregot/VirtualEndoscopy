import React, { type ChangeEvent, type ReactElement, useEffect, useState } from 'react';
import { BaseButton } from '../../../base/Button';
import { useAppSelector } from '../../../../hooks/redux';
import { Popup } from '../../../base/Popup';
import ProgressBar from 'react-bootstrap/ProgressBar';
import styles from './Segmentation.module.scss';
import * as THREE from 'three';
import { AortaSelect, type AortaSelectionProps } from './AortaSelect';

import { FFRController } from '../../../../lib/connection/FFRController';
import { type AortaView } from '../../../../lib/visualization';

interface ProgressBarData {
    title: string
    subtitle: string
}

interface TProps {
    onSelectAorta: (aorta: AortaView) => void
}

export const Segmentation = (props: TProps): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);
    const { webSocket } = useAppSelector((state) => state.webSocket);
    const [disabledFFR, setDisabledFFR] = useState(false);
    const [selectedAorta, setSelectedAorta] = useState<AortaSelectionProps | null>(null);
    const [ffrController, setFFRController] = useState<FFRController | null>(null);
    const [progressBarInfo, setProgressBarInfo] = useState<ProgressBarData | null>(null);
    const [progressBarPercent, setProgressBarPercent] = useState<number>(0);

    const [ROI, setROI] = useState(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)));

    useEffect(() => {
        setDisabledFFR(webSocket === null);
    }, [webSocket]);
    
    useEffect(() => {
        if (selectedPreviewSeries !== null) {
            setROI(selectedPreviewSeries.getROI());
        }
    }, [selectedPreviewSeries]);

    useEffect(() => {
        if (selectedPreviewSeries !== null && webSocket !== null && selectedPreviewSeries.getStack()._numberOfFrames >= 30) {
            setFFRController(new FFRController(webSocket, selectedPreviewSeries.getModel()));
        }
    }, [selectedPreviewSeries, webSocket]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        switch (event.target.name) {
            case 'xStart':
                setROI(new THREE.Box3(new THREE.Vector3(Number(event.target.value), ROI.min.y, ROI.min.z), new THREE.Vector3(ROI.max.x, ROI.max.y, ROI.max.z)));
                break;
            case 'yStart':
                setROI(new THREE.Box3(new THREE.Vector3(ROI.min.x, Number(event.target.value), ROI.min.z), new THREE.Vector3(ROI.max.x, ROI.max.y, ROI.max.z)));
                break;
            case 'zStart':
                setROI(new THREE.Box3(new THREE.Vector3(ROI.min.x, ROI.min.y, Number(event.target.value)), new THREE.Vector3(ROI.max.x, ROI.max.y, ROI.max.z)));
                break;
            case 'xEnd':
                setROI(new THREE.Box3(new THREE.Vector3(ROI.min.x, ROI.min.y, ROI.min.z), new THREE.Vector3(Number(event.target.value), ROI.max.y, ROI.max.z)));
                break;
            case 'yEnd':
                setROI(new THREE.Box3(new THREE.Vector3(ROI.min.x, ROI.min.y, ROI.min.z), new THREE.Vector3(ROI.max.x, Number(event.target.value), ROI.max.z)));
                break;
            case 'zEnd':
                setROI(new THREE.Box3(new THREE.Vector3(ROI.min.x, ROI.min.y, ROI.min.z), new THREE.Vector3(ROI.max.x, ROI.max.y, Number(event.target.value))));
                break;      
            default:
                console.log('ERROR');
                break;
        }
    };

    /**
     * Шаг 1 - загрузка DICOM
     */
    const initializeFFR = (): void => {
        if (selectedPreviewSeries === null || webSocket === null || ffrController === null) return;
        const controller = ffrController;
        const currentProgressBar = {
            title: 'Transfering DICOM data',
            subtitle: 'Загрузка DICOM файлов....'
        };
        setProgressBarInfo(currentProgressBar);
        setProgressBarPercent(0);
        void (new Promise(resolve => {
            void controller.start(
                (val: any) => {
                    val = Number(val);
                    if (typeof val === 'number') {
                        setProgressBarPercent(val);
                    } 
                },
                (blob: Blob, circles: Float64Array) => {
                    setProgressBarInfo(null);
                    setSelectedAorta({
                        stack: selectedPreviewSeries.getModel().stack[0],
                        imgBlob: blob,
                        circles
                    });
                }
            );
        }));
    };

    /**
     * Шаг 2 - после выбора аорты
     * 
     * @param center
     * @param radius
     */
    const onAcceptAortaHandler = (center: THREE.Vector3, radius: number): void => {
        setSelectedAorta(null);
        if (ffrController === null) return;
        const controller = ffrController;
        const currentProgressBar = {
            title: 'Prepare aorta data',
            subtitle: 'Подготовка данных об аорте...'
        };
        setProgressBarInfo(currentProgressBar);
        void (new Promise(resolve => {
            void controller.initializeAndSegmentAorta(center, radius, (val: number) => {
                setProgressBarPercent(val);
            }).then((aorta: AortaView) => {
                setProgressBarInfo(null);
                props.onSelectAorta(aorta);
            });
        }));
    };

    return (
        <div>
            {
                selectedAorta !== null
                    ? (
                        <Popup show={true} title={'Select Aorta'} onClose={() => { setSelectedAorta(null); }}>
                            <AortaSelect onAccept={onAcceptAortaHandler} onReject={() => { setSelectedAorta(null); }} aortaSelectionProps={selectedAorta}/>
                        </Popup>
                    )
                    : ''
            }

            {
                progressBarInfo !== null
                    ? (
                        <Popup style={{ minWidth: '500px' }} onClose={() => { console.log('closed'); }} title={progressBarInfo.title} show={true}>
                            <div style={{ paddingBottom: '20px', width: '100%' }}>
                                {progressBarInfo.subtitle}
                                <ProgressBar animated now={progressBarPercent} label={`${progressBarPercent}%`} />
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
                        <input type="number" min="1" name="zEnd" max={selectedPreviewSeries?.getROI().max.z} value={ROI.max.z} onChange={handleChange} />
                    </div>
                </div>
                <div className={styles.buttons}>
                    <BaseButton onClick={() => {}}>Сбросить ROI</BaseButton>
                    <BaseButton disabled={disabledFFR} onClick={initializeFFR}>Запустить FFR инициализацию</BaseButton>
                </div>
            </div>
        </div>
    );
};
