import React, { type ReactElement } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { SeriesInfoList } from './SeriesInfoList';
import { CalculationSetup } from './CalculationSetup';
import { VisualizationEmptyState } from '../Common/VisualizationEmptyState';
import { MovablePopup } from '../../base/Popup';

export const SeriesPreview = (): ReactElement => {
    return (
        <Splitter style={{ height: '90vh' }}>
            <SplitterPanel size={45} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* <MovablePopup title={'test title'} onClose={() => {}}>Test content</MovablePopup> */}
                <CalculationSetup/>
            </SplitterPanel>
            <SplitterPanel size={60}>
                <Splitter layout="vertical">
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        <VisualizationEmptyState />
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
