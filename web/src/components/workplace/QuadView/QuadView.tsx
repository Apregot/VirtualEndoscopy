import React, { type ReactElement } from 'react';
import * as THREE from 'three';
import { useAppSelector } from '../../../hooks/redux';
import styles from './QuadView.module.scss';

export const QuadView = (): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.seriesReducer);

    let title = 'NONE SELECTED';
    if (selectedPreviewSeries !== null) {
        title = `selected ${selectedPreviewSeries.getId()}`;
        console.log(`${title} was selected`);
        const seriesStack = selectedPreviewSeries.getModel().stack[0];

        // old_www/js/ui/components/quadview.js:162 , загрузка серии в фреймы. Следует разобраться и добавить типы
        // old_www/js/ui/components/quadview.js:107 начинать ресерч от сюда
        const RIO = new THREE.Box3(new THREE.Vector3(0, 0, 0), seriesStack.dimensionsIJK.clone());
        console.log(RIO);
    }
    return (
        <div className={styles.wrapper}>
            <div className={`${styles.renderer} ${styles.red}`}></div>
            <div className={`${styles.renderer} ${styles.blue}`}></div>
            <div className={`${styles.renderer} ${styles.yellow}`}></div>
            <div className={`${styles.renderer} ${styles.green}`}></div>
        </div>
    );
};
