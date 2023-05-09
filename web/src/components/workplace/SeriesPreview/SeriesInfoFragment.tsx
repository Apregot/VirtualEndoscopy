import React, { type ReactElement, useEffect, useRef, useState } from 'react';
import styles from './SeriesInfo.module.scss';
import { type Series } from '../../../lib/Series';
import { SelectPopupList } from '../../base/SelectList/SelectPopupList';
import { seriesSlice } from '../../../store/reducers/SeriesSlice';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { UP3 } from '../../../lib/visualization';

interface TProps {
    series: Series
}

enum ContextMenuAction {
    OPEN_SERIES,
    CLOSE_SERIES,
    SPLIT_SERIES,
}

export const SeriesInfoFragment = (props: TProps): ReactElement => {
    const series = props.series;
    const [contextOpened, openContext] = useState(false);
    const [seriesImg, setSeriesImg] = useState('');
    
    const { selectedPreviewSeries } = useAppSelector((state) => state.patientsSeriesList);

    const { selectPreviewSeries, deleteSeries } = seriesSlice.actions;
    const dispatch = useAppDispatch();

    const divRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current === null || seriesImg !== '' || divRef.current === null) {
            return;
        }

        const dicomPreviewDiv = divRef.current as HTMLDivElement;
        const rx = UP3.enable(dicomPreviewDiv);
        if (rx.domElement === null) return;

        rx.sliceColor = 0xffffff;
        UP3.initRenderer2D(dicomPreviewDiv);

        if (rx.renderer === null || rx.scene === null || rx.camera === null) return;

        rx.sliceOrientation = 'axial';
        UP3.initHelpersStack(rx, series.getModel().stack[0]);

        const canvas = rx.domElement.firstChild;
        if (canvas === null) return;
        rx.renderer.render(rx.scene, rx.camera);
        const canvas1 = canvasRef.current as HTMLCanvasElement;
        const ctx = canvas1.getContext('2d');
        if (ctx === null) return;
        ctx.drawImage(canvas as CanvasImageSource, 0, 0);
        ctx.font = 'bold 36px serif';
        // ctx.fillStyle('#ff0000');
        const n = series.getModel().stack[0]._numberOfFrames; const xOffset = n < 10 ? 107 : n < 100 ? 90 : n < 1000 ? 70 : 50;
        ctx.fillText(n.toString(), xOffset, 1);
        setSeriesImg((canvas as HTMLCanvasElement).toDataURL());
        canvas1.style.display = 'none';
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
        if (itemId === ContextMenuAction.CLOSE_SERIES) {
            console.log('split');
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
        <div className="flex relative">
            <div className={(selectedPreviewSeries?.getROI() === series.getROI()) ? `${styles.patientSeries} ${styles.isSelected}` : `${styles.patientSeries}`}>
                <div style={{ borderRadius: '12px', overflow: 'hidden', marginRight: '15px' }} ref={divRef}>
                    <canvas ref={canvasRef} width='128' height='128'/>
                </div>
                <div style={{ minWidth: '130px' }}>
                    <div className={styles.header}>
                        <span className={styles.infoTitle}>Номер: {series.getSN()}</span>
                        <div className={styles.menuButton} onClick={onContextMenuCalled}></div>
                    </div>
                    <div className={styles.infoData}>
                        <span className={styles.infoDataRow}>PN: <span className={styles.infoDataRowValue}>{series.getPN()}</span></span>
                        <span className={styles.infoDataRow}>SD: <span className={styles.infoDataRowValue}>{series.getSD()}</span></span>
                        <span className={styles.infoDataRow}>Кадров: <span className={styles.infoDataRowValue}>{series.getNF()}</span></span>
                    </div>
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
                    },
                    {
                        id: ContextMenuAction.SPLIT_SERIES,
                        content: <span>Проредить серию</span>
                    }
                ]}

                onItemSelect={onContextMenuItemSelect}
            />
        </div>
    );
};

