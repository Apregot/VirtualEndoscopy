import React, { type ReactElement } from 'react';
import { BorderedBox } from '../../../base/BorderedBox';
import { ConnectionInfo } from './ConnectionInfo';
import { Segmentation } from './Segmentation';
import { type AortaView } from '../../../../lib/visualization';

export const CalculationSetup = (): ReactElement => {
    const handleSelectedAorta = (aorta: AortaView): void => {
        console.log(aorta);
    };
    return (
        <>
            <BorderedBox title="3D Сегментация">
                <Segmentation onSelectAorta={handleSelectedAorta}/>
            </BorderedBox>
            <BorderedBox title="Настройки соединения">
                <ConnectionInfo/>
            </BorderedBox>
        </>
    );
};
