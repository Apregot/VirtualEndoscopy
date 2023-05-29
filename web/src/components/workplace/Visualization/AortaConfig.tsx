import React, { type ReactElement, useEffect, useState } from 'react';
import { MovablePopup } from '../../base/Popup';
import { type AortaView } from '../../../lib/visualization';
import styles from './AortaConfig.module.scss';
import Tab from 'react-bootstrap/Tab';
import Form from 'react-bootstrap/Form';
import Tabs from 'react-bootstrap/Tabs';
import { BaseButton } from '../../base/Button';

interface TProps {
    aorta: AortaView
    onTauChange: (tau: number) => void
    isLoading: boolean
}

export const AortaConfig = (props: TProps): ReactElement => {
    const [tau, setTau] = useState<number>(props.aorta.tau);
    const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
    useEffect(() => {
        if (timerId !== null) {
            clearTimeout(timerId);
        }
        setTimerId(setTimeout(() => { props.onTauChange(tau); setTimerId(null); }, 400));
    }, [tau]);

    return (
        <MovablePopup title={'Параметры сегментации аорты'} onClose={() => {}}>
            <div className={styles.wrapper + ' ' + 'defaultBehavior'}>
                <Tabs
                    defaultActiveKey="segmentation"
                >
                    <Tab
                        eventKey="segmentation"
                        key="segmentation"
                        title="Сегментация аорты"
                    >
                        <div className={styles.tabContent}>
                            <div className={styles.rangeWrapper}>
                                <Form.Label><span className={styles.title}>Порог:</span> <span className={styles.value}>{tau}</span>
                                    {
                                        props.isLoading
                                            ? <span className={'text-yellow-500'}> Загрузка...</span>
                                            : ''
                                    }
                                </Form.Label>
                                <Form.Range
                                    disabled={props.isLoading}
                                    onChange={(e) => { setTau(Number(e.target.value)); }}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={tau}
                                    className={styles.range}
                                />
                            </div>
                            <div className={styles.rangeSubtitle}>
                                Выберете порог так, чтобы была видна аорта и части коронарных артерий.
                            </div>
                        </div>
                    </Tab>
                    <Tab
                        key="settings"
                        eventKey="settings"
                        title="Параметры"
                    >
                        <div className={styles.tabContent}>
                        55
                        </div>
                    </Tab>
                </Tabs>
                <div className={styles.buttonsPanel}>
                    <BaseButton onClick={() => {}}>OK</BaseButton>
                    <BaseButton onClick={() => {}}>Cancel</BaseButton>
                </div>
            </div>
        </MovablePopup>
    );
};
