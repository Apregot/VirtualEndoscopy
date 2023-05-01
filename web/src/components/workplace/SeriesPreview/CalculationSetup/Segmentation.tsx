import React, { type ChangeEvent, type ReactElement, useEffect, useState } from 'react';
import { BaseButton } from '../../../base/Button';
import { useAppSelector } from '../../../../hooks/redux';
import { Popup } from '../../../base/Popup';
import ProgressBar from 'react-bootstrap/ProgressBar';
import styles from './Segmentation.module.scss';
import * as THREE from 'three';

export const Segmentation = (): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);
    const [loader, setLoader] = useState(false);

    const [ROI, setROI] = useState(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)));

    const disabled = selectedPreviewSeries === null;
    useEffect(() => {
        if (selectedPreviewSeries !== null) {
            setROI(selectedPreviewSeries.getROI());
        }
    }, [selectedPreviewSeries]);

    const handleChange = (event: ChangeEvent): void => {

    };

    const initializeFFR = (): void => {
        setLoader(true);
    };

    return (
        <div>
            {
                loader
                    ? (
                        <Popup onClose={() => { setLoader(false); }} title={'Transfering DICOM data'} show={true}>
                            <div style={{ paddingBottom: '20px' }}>
                        Загрузка DICOM...
                                <ProgressBar animated now={60} label={'60%'} />
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
                    <BaseButton disabled={disabled} onClick={initializeFFR}>Initialize FFR processing</BaseButton>
                </div>
            </div>
        </div>
    );
};
