import React, { type ReactElement } from 'react';
import styles from './SeriesInfo.module.scss';
import { type Series } from '../../../lib/Series';
import { PatientSex } from '../../../lib/Patient';
import { SeriesInfoFragment } from './SeriesInfoFragment';
import { Text } from '../../../lib/utils';
interface TProps {
    series: Series[]
}

export const SeriesInfo = (props: TProps): ReactElement => {
    const series = props.series;
    const patient = series.at(0)?.getPatient();

    return (
        <div className="flex p-3">
            <div className={styles.patientInfo}>
                <span className={styles.infoTitle}>Информация o пациенте</span>
                <div className={styles.infoData}>
                    <span className={styles.infoDataRow}>[{series.at(0)?.getModality()}] {patient?.name}</span>
                    <span className={styles.infoDataRow}>Карта: <span className={styles.infoDataRowValue}></span></span>
                    <span className={styles.infoDataRow}>Пол: <span className={styles.infoDataRowValue}>{patient?.sex === PatientSex.FEMALE ? 'Женский' : 'Мужской'}</span></span>
                    <span className={styles.infoDataRow}>Дата рождения: <span className={styles.infoDataRowValue}>{patient?.birthdate}</span></span>
                    <span className={styles.infoDataRow}>Дата посещения: <span className={styles.infoDataRowValue}>Ольга</span></span>
                </div>
            </div>
            {series.map((seriesItem: Series) => (
                <SeriesInfoFragment key={Text.generateUUID()} series={seriesItem} />
            ))}

        </div>
    );
};
