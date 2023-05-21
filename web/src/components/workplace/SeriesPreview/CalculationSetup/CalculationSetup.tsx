import React, { type ReactElement } from 'react';
import { BorderedBox } from '../../../base/BorderedBox';
import { ConnectionInfo } from './ConnectionInfo';
import { Segmentation } from './Segmentation';
import { type AortaView } from '../../../../lib/visualization';

interface TProps {
    onAortaSelected: (aorta: AortaView) => void
}

export const CalculationSetup = (props: TProps): ReactElement => {
    return (
        <>
            <BorderedBox title="3D Сегментация">
                <Segmentation onSelectAorta={props.onAortaSelected}/>
            </BorderedBox>
            <BorderedBox title="Настройки соединения">
                <ConnectionInfo/>
            </BorderedBox>
        </>
    );
};
