import React, { type ReactElement } from 'react';
import styles from './VisualizationEmptyState.module.scss';
import { ReactComponent as Heart } from './heart.svg';

export const VisualizationEmptyState = (): ReactElement => {
    return (
        <div className={styles.wrapper}>
            <Heart style={{ maxWidth: '200px', maxHeight: '200px', padding: '20px' }} />
            <div className={styles.stub}>
                <div className={styles.title}>Нет данных</div>
                <div className={styles.subtitle}>Загрузите DICOM файл для начала анализа</div>
            </div>
        </div>
    );
};
