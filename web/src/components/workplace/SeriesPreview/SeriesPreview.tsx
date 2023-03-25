import React, { type ReactElement } from 'react';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

export const SeriesPreview = (): ReactElement => {
    return (
        <Splitter style={{ height: '90vh' }}>
            <SplitterPanel size={1}>
                <Splitter layout="vertical">
                    <SplitterPanel>
                        1
                    </SplitterPanel>
                    <SplitterPanel>
                        3
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
            <SplitterPanel size={60}>
                <Splitter layout="vertical">
                    <SplitterPanel>
                        2
                    </SplitterPanel>
                    <SplitterPanel size={30}>
                        <Tabs
                            defaultActiveKey="unsorted"
                            id="uncontrolled-tab-example"
                            className="mb-3 bg-neutral-50"
                        >
                            <Tab eventKey="unsorted" title="Несортированные изображения">
                                123
                            </Tab>
                            <Tab eventKey="pochukaeva" title="POCHUKAEVA.V.1">
                                Pochukaeva info
                            </Tab>
                        </Tabs>
                    </SplitterPanel>
                </Splitter>
            </SplitterPanel>
        </Splitter>
    );
};
