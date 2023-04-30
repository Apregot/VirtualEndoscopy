import React, { type ReactElement } from 'react';
import { BorderedBox } from '.././../../base/BorderedBox';
import { SeriesConnection } from './SeriesConnection';
import { Segmentation } from './Segmentation';

export const CalculationSetup = (): ReactElement => {
    return (
        <>
            <BorderedBox title="3D Сегментация">
                <Segmentation/>
            </BorderedBox>
            <BorderedBox title="Настройки соединения">
                <SeriesConnection/>
            </BorderedBox>
        </>
    );
};
