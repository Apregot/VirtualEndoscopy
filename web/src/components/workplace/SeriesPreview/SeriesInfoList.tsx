import React, { type ReactElement } from 'react';
import Tab from 'react-bootstrap/Tab';
import { SeriesInfo } from './SeriesInfo';
import Tabs from 'react-bootstrap/Tabs';
import { useAppSelector } from '../../../hooks/redux';
import { type Series } from '../../../lib/Series';

export const SeriesInfoList = (): ReactElement => {
    const { series } = useAppSelector(state => state.seriesReducer);

    return (
        <Tabs
            defaultActiveKey="unsorted"
            id="uncontrolled-tab-example"
            className="bg-neutral-50"
        >
            <Tab eventKey="unsorted" title="Несортированные изображения">
                unsorted
            </Tab>
            {series.map((seriesItem: Series) => {
                return (
                    <Tab key={seriesItem.getId()} eventKey={seriesItem.getId()} title={seriesItem.getPatient().name}>
                        <SeriesInfo series={seriesItem} />
                    </Tab>
                );
            })}
        </Tabs>
    );
};
