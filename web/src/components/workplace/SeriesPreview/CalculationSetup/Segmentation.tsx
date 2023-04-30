import React, { type ReactElement, useState } from 'react';
import { BaseButton } from '../../../base/Button';
import { useAppSelector } from '../../../../hooks/redux';
import { Popup } from '../../../base/Popup';
import ProgressBar from 'react-bootstrap/ProgressBar';

export const Segmentation = (): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);
    const [loader, setLoader] = useState(false);

    const disabled = selectedPreviewSeries === null;
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
            <BaseButton disabled={disabled} onClick={() => { console.log('initializing ffr...'); setLoader(true); }}>Initialize FFR processing</BaseButton>
        </div>
    );
};
