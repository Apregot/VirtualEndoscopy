import React, { type ReactElement } from 'react';
import styles from './SeriesInfo.module.scss';
import { type Series } from '../../../lib/Series';
import { PatientSex } from '../../../lib/Patient';

interface TProps {
    series: Series
}

export const SeriesInfo = (props: TProps): ReactElement => {
    const series = props.series;
    const patient = series.getPatient();
    return (
        <div className="flex p-3">
            <div className={styles.patientInfo}>
                <span className={styles.infoTitle}>Информация о пациенте</span>
                <div className={styles.infoData}>
                    <span className={styles.infoDataRow}>[{series.getModality()}] {patient.name}</span>
                    <span className={styles.infoDataRow}>Карта: <span className={styles.infoDataRowValue}></span></span>
                    <span className={styles.infoDataRow}>Пол: <span className={styles.infoDataRowValue}>{patient.sex === PatientSex.FEMALE ? 'Женский' : 'Мужской'}</span></span>
                    <span className={styles.infoDataRow}>Дата рождения: <span className={styles.infoDataRowValue}>{patient.birthdate}</span></span>
                    <span className={styles.infoDataRow}>Дата посещения: <span className={styles.infoDataRowValue}>Ольга</span></span>
                </div>
            </div>
            <div className={styles.patientSeries}>
                Patient series
            </div>
        </div>
    );
};
