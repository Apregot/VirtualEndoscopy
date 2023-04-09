import React, { type ReactElement } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { SeriesInfo } from './SeriesInfo';
import { SeriesInfoList } from './SeriesInfoList';
import { QuadView } from '../QuadView';

export const SeriesPreview = (): ReactElement => {
    return (
        <Splitter style={{ height: '90vh' }}>
            <SplitterPanel size={1}>
                <Splitter layout="vertical">
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        1
                    </SplitterPanel>
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        3
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
            <SplitterPanel size={60}>
                <Splitter layout="vertical">
                    <SplitterPanel style={{ overflow: 'hidden' }}>
                        <QuadView/>
                    </SplitterPanel>
                    <SplitterPanel size={30} style={{ overflow: 'hidden' }}>
                        <SeriesInfoList/>
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
        </Splitter>
    );
};
