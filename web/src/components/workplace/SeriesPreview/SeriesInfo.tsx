import React, { type ReactElement } from 'react';
import styles from './SeriesInfo.module.scss';

export const SeriesInfo = (): ReactElement => {
    return (
        <div className="flex p-3">
            <div className={styles.patientInfo}>
                <span className={styles.infoTitle}>Информация о пациенте</span>
                <div className={styles.infoData}>
                    <span className={styles.infoDataRow}>[CT] POCHUKAEVA V.I. 35771</span>
                    <span className={styles.infoDataRow}>Карта: <span className={styles.infoDataRowValue}>Ольга</span></span>
                    <span className={styles.infoDataRow}>Пол: <span className={styles.infoDataRowValue}>Ольга</span></span>
                    <span className={styles.infoDataRow}>Дата рождения: <span className={styles.infoDataRowValue}>Ольга</span></span>
                    <span className={styles.infoDataRow}>Дата посещения: <span className={styles.infoDataRowValue}>Ольга</span></span>
                </div>
            </div>
            <div className={styles.patientSeries}>
                Patient series
            </div>
        </div>
    );
};
