import React, { type ChangeEvent, type ReactElement, useEffect, useState } from 'react';
import { BaseButton } from '../../../base/Button';
import { useAppSelector } from '../../../../hooks/redux';
import { Popup } from '../../../base/Popup';
import ProgressBar from 'react-bootstrap/ProgressBar';
import styles from './Segmentation.module.scss';

export const Segmentation = (): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);
    const [loader, setLoader] = useState(false);

    const [ROI, setROI] = useState({
        xStart: 0,
        xEnd: 1,
        yStart: 0,
        yEnd: 1,
        zStart: 0,
        zEnd: 1
    });

    const disabled = selectedPreviewSeries === null;
    useEffect(() => {
        if (selectedPreviewSeries !== null) {
            const ROI = selectedPreviewSeries.getROI();
            setROI({
                xStart: ROI.getX(),
                yStart: ROI.getY(),
                zStart: ROI.getZ(),
                xEnd: ROI.getXDistance(),
                yEnd: ROI.getYDistance(),
                zEnd: ROI.getZDistance()
            });
        }
    }, [selectedPreviewSeries]);

    const handleChange = (event: ChangeEvent): void => {

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
                        <input type="number" min="0" name="xStart" value={ROI.xStart} onChange={handleChange} />
                        <input type="number" min="0" name="yStart" value={ROI.yStart} onChange={handleChange} />
                        <input type="number" min="0" name="zStart" value={ROI.zStart} onChange={handleChange} />
                    </div>
                </div>
                <div>
                    <label>Размер (x, y, z)</label>
                    <div>
                        <input type="number" min="1" name="xEnd" value={ROI.xEnd} onChange={handleChange} />
                        <input type="number" min="1" name="yEnd" value={ROI.yEnd} onChange={handleChange} />
                        <input type="number" min="1" name="zEnd" value={ROI.zEnd} onChange={handleChange} />
                    </div>
                </div>
                <div className={styles.buttons}>
                    <BaseButton onClick={() => {}}>Сбросить ROI</BaseButton>
                    <BaseButton disabled={disabled} onClick={() => { console.log('initializing ffr...'); setLoader(true); }}>Initialize FFR processing</BaseButton>
                </div>
            </div>
        </div>
    );
};
