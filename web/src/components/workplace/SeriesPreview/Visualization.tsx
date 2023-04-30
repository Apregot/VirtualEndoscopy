import React, { type ReactElement } from 'react';
import styles from './SeriesInfoList.module.scss';
import Tab from 'react-bootstrap/Tab';
import { Series } from '../../../lib/Series';
import { SeriesInfo } from './SeriesInfo';
import Tabs from 'react-bootstrap/Tabs';

export const Visualization = (): ReactElement => {
    return (
        <Tabs
            defaultActiveKey="visualization"
            id="uncontrolled-tab-example"
            className={styles.tabs}
        >
            <Tab eventKey="visualization" title="Визуализация" key="visualization">
                Visualization block
            </Tab>
        </Tabs>
    );
};
