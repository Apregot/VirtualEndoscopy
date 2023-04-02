import React, { type ReactElement } from 'react';
import styles from './SeriesInfo.module.scss';
import { type Series } from '../../../lib/Series';

interface TProps {
    series: Series
}

export const SeriesInfoFragment = (props: TProps): ReactElement => {
    const series = props.series;
    return (
        <div className="flex p-3">
                    <div className={styles.patientSeries}>
                    <span className={styles.infoTitle}>Номер: {series.getSN()}</span>
                    <div className={styles.infoData}>
                         <span className={styles.infoDataRow}>PN: <span className={styles.infoDataRowValue}>{series.getPN()}</span></span>
                         <span className={styles.infoDataRow}>SD: <span className={styles.infoDataRowValue}>{series.getSD()}</span></span>
                         <span className={styles.infoDataRow}>Кадров: <span className={styles.infoDataRowValue}>{series.getNF()}</span></span>
                     </div>
                 </div>
        </div>
    );
};