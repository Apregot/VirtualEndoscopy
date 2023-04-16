import React, { type ReactElement, useEffect, useRef, useState } from 'react';
import styles from './SeriesInfo.module.scss';
import { type Series } from '../../../lib/Series';
import { SelectPopupList } from '../../base/SelectList/SelectPopupList';
import { seriesSlice } from '../../../store/reducers/SeriesSlice';
import { useAppDispatch } from '../../../hooks/redux';
import { UP3 } from '../../../lib/visualization';

interface TProps {
    series: Series
}

enum ContextMenuAction {
    OPEN_SERIES,
    CLOSE_SERIES,
}

export const SeriesInfoFragment = (props: TProps): ReactElement => {
    const series = props.series;
    const [contextOpened, openContext] = useState(false);

    const { selectPreviewSeries, deleteSeries } = seriesSlice.actions;
    const dispatch = useAppDispatch();

    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current === null) {
            return;
        }

        const dicomPreviewDiv = canvasRef.current as HTMLDivElement;
        const rx = UP3.enable(dicomPreviewDiv);
        rx.sliceColor = 0x000000;
        UP3.initRenderer2D(dicomPreviewDiv);
        rx.sliceOrientation = 'axial';
    }, [canvasRef]);

    // TODO: must be splitted into contextMenuAvailable component
    const onContextMenuCalled = (event: React.MouseEvent): void => {
        openContext(true);
        event.preventDefault();
    };

    const onContextMenuItemSelect = (itemId: string | number): void => {
        console.log(`[SERIES LIST] Selected menu ${itemId}`);
        openContext(false);

        if (itemId === ContextMenuAction.OPEN_SERIES) {
            dispatch(selectPreviewSeries(series));
        }
        if (itemId === ContextMenuAction.CLOSE_SERIES) {
            dispatch(deleteSeries(series));
        }
    };

    useEffect(() => {
        if (contextOpened) {
            setTimeout(() => {
                const onOtherAction = (): void => {
                    openContext(false);
                    document.removeEventListener('click', onOtherAction);
                    document.removeEventListener('contextmenu', onOtherAction);
                };

                // HACK: При нажатии на другие кнопки нужно скрывать чужие меню. Для реализации оного в голову пришла только идея с таймером
                document.addEventListener('click', onOtherAction, { once: true });
                document.addEventListener('contextmenu', onOtherAction, { once: true });
            }, 0);
        }
    }, [contextOpened]);

    return (
        <div className="flex p-3 relative">
            <div onContextMenu={onContextMenuCalled} className={styles.patientSeries}>
                <div ref={canvasRef}></div>
                <span className={styles.infoTitle}>Номер: {series.getSN()}</span>
                <div className={styles.infoData}>
                    <span className={styles.infoDataRow}>PN: <span className={styles.infoDataRowValue}>{series.getPN()}</span></span>
                    <span className={styles.infoDataRow}>SD: <span className={styles.infoDataRowValue}>{series.getSD()}</span></span>
                    <span className={styles.infoDataRow}>Кадров: <span className={styles.infoDataRowValue}>{series.getNF()}</span></span>
                </div>
            </div>
            <SelectPopupList
                opened={contextOpened}

                className={styles.contextMenu}

                items={[
                    {
                        id: ContextMenuAction.OPEN_SERIES,
                        content: <span>Открыть серию</span>
                    },
                    {
                        id: ContextMenuAction.CLOSE_SERIES,
                        content: <span>Закрыть серию</span>
                    }
                ]}

                onItemSelect={onContextMenuItemSelect}
            />
        </div>
    );
};
