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
}

export const AortaConfig = (props: TProps): ReactElement => {
    const [tau, setTau] = useState<number>(props.aorta.tau);
    useEffect(() => {
        props.onTauChange(tau);
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
                                <Form.Label><span className={styles.title}>Порог:</span> <span className={styles.value}>{tau}</span></Form.Label>
                                <Form.Range
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
