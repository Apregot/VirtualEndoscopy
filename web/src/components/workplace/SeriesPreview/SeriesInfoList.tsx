import React, { type ReactElement } from 'react';
import Tab from 'react-bootstrap/Tab';
import { SeriesInfo } from './SeriesInfo';
import Tabs from 'react-bootstrap/Tabs';
import { useAppSelector } from '../../../hooks/redux';
import { type Series } from '../../../lib/Series';

export const SeriesInfoList = (): ReactElement => {
    const { patientsSeriesList } = useAppSelector((state) => state.seriesReducer);
    console.log(patientsSeriesList);
    return (
        <Tabs
            defaultActiveKey="unsorted"
            id="uncontrolled-tab-example"
            className="bg-neutral-50"
        >
            <Tab eventKey="unsorted" title="Несортированные изображения">
        unsorted
            </Tab>
            {patientsSeriesList?.map((seriesListItem: Series[]) => {
                const seriesItem = seriesListItem.at(0);
                return (
                    <Tab
                        key={seriesItem?.getId()}
                        eventKey={seriesItem?.getId()}
                        title={seriesItem?.getPatient().name}
                    >
                        <SeriesInfo series={seriesListItem} />
                    </Tab>
                );
            })}
        </Tabs>
    );
};
