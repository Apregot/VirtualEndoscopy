import React, { type ReactElement } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { SeriesInfo } from './SeriesInfo';

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
                        2
                    </SplitterPanel>
                    <SplitterPanel size={30} style={{ overflow: 'hidden' }}>
                        <Tabs
                            defaultActiveKey="unsorted"
                            id="uncontrolled-tab-example"
                            className="bg-neutral-50"
                        >
                            <Tab eventKey="unsorted" title="Несортированные изображения">
                                <SeriesInfo/>
                            </Tab>
                            <Tab eventKey="pochukaeva" title="POCHUKAEVA.V.1">
                                <SeriesInfo/>
                            </Tab>
                        </Tabs>
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
        </Splitter>
    );
};
