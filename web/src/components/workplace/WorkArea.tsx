import React, { type ReactElement } from 'react';
import { SeriesPreview } from './SeriesPreview';

export const WorkArea = (): ReactElement => {
    // Временно возвращаем компонент превью. В будущем научится сменяться при загрузке серий по сокету
    return (
        <SeriesPreview/>
    );
};
