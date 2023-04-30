import React, { type ReactElement } from 'react';
import { BaseButton } from '../../../base/Button';
import { useAppSelector } from '../../../../hooks/redux';

export const Segmentation = (): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);

    const disabled = selectedPreviewSeries === null;
    return (
        <div>
            <BaseButton disabled={disabled} onClick={() => { console.log('initializing ffr...'); }}>Initialize FFR processing</BaseButton>
        </div>
    );
};
