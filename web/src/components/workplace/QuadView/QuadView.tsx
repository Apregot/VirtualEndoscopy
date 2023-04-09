import React, { type ReactElement } from 'react';
import * as THREE from 'three';
import { useAppSelector } from '../../../hooks/redux';

export const QuadView = (): ReactElement => {
    const { selectedPreviewSeries } = useAppSelector((state) => state.seriesReducer);

    let title = 'NONE SELECTED';
    if (selectedPreviewSeries !== null) {
        title = `selected ${selectedPreviewSeries.getId()}`;
        const seriesStack = selectedPreviewSeries.getModel().stack[0];

        // old_www/js/ui/components/quadview.js:162 , загрузка серии в фреймы. Следует разобраться и добавить типы
        // old_www/js/ui/components/quadview.js:107 начинать ресерч от сюда
        const RIO = new THREE.Box3(new THREE.Vector3(0, 0, 0), seriesStack.dimensionsIJK.clone());
        console.log(RIO);
    }
    return (
        <h1>{ title }</h1>
    );
};
