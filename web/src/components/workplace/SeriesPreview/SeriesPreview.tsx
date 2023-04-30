import React, { type ReactElement } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { SeriesInfoList } from './SeriesInfoList';
import { QuadView } from './QuadView';
import { Visualization } from './Visualization';
import { CalculationSetup } from './CalculationSetup';

export const SeriesPreview = (): ReactElement => {
    return (
        <Splitter style={{ height: '90vh' }}>
            <SplitterPanel size={1}>
                <Splitter layout="vertical">
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        <Visualization/>
                    </SplitterPanel>
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        <CalculationSetup/>
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
            <SplitterPanel size={60}>
                <Splitter layout="vertical">
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        <QuadView />
                    </SplitterPanel>
                    <SplitterPanel size={30} style={{ overflow: 'hidden' }}>
                        <SeriesInfoList />
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
        </Splitter>
    );
};
