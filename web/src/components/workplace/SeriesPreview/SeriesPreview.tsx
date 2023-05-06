import React, { type ReactElement } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { SeriesInfoList } from './SeriesInfoList';
import { QuadView } from './QuadView';
import { Visualization } from './Visualization';
import { CalculationSetup } from './CalculationSetup';

export const SeriesPreview = (): ReactElement => {
    return (
        <Splitter style={{ height: '90vh' }}>
            <SplitterPanel size={45}>
                <Splitter layout="vertical">
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        <Visualization/>
                    </SplitterPanel>
                    <SplitterPanel className="overflow-y-scroll">
                        <CalculationSetup/>
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
            <SplitterPanel size={60}>
                <Splitter layout="vertical">
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        <QuadView />
                    </SplitterPanel>
                    <SplitterPanel size={30} className="overflow-y-scroll">
                        <SeriesInfoList />
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
        </Splitter>
    );
};
