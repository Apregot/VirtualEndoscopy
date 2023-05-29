import React, { type ReactElement, useState } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { SeriesInfoList } from './SeriesInfoList';
import { CalculationSetup } from './CalculationSetup';
import { VisualizationEmptyState } from '../Common/VisualizationEmptyState';
import { AortaConfig } from '../Visualization/AortaConfig';
import { type AortaView } from '../../../lib/visualization';
import { AortaPreview } from '../Visualization/AortaPreview';

export const SeriesPreview = (): ReactElement => {
    const [aorta, setAorta] = useState<AortaView | null>(null);

    return (
        <Splitter style={{ height: '90vh' }}>
            <SplitterPanel size={45} style={{ display: 'flex', flexDirection: 'column' }}>
                <CalculationSetup onAortaSelected={(aorta: AortaView) => { setAorta(aorta); }}/>
            </SplitterPanel>
            <SplitterPanel size={60}>
                <Splitter layout="vertical">
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        {
                            aorta !== null
                                ? <AortaPreview aortaView={aorta} />
                                : <VisualizationEmptyState />
                        }
                        {/* Нужно вынести компонент в другое место, плюс смену компонента когда сделаем работу с 2д */}
                    </SplitterPanel>
                    <SplitterPanel size={30} className="overflow-y-scroll">
                        <SeriesInfoList />
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
        </Splitter>
    );
};
