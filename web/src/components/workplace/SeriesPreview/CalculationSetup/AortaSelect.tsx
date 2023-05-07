import React, { type ReactElement } from 'react';
import { type Stack } from 'ami.js';
import styles from './AortaSelect.module.scss';
import { BaseButton } from '../../../base/Button';

interface TProps {
    aortaSelectionProps: AortaSelectionProps
}

export interface AortaSelectionProps {
    stack: Stack
    imgBlob: Blob
    circles: Float64Array
}

export const AortaSelect = (props: TProps): ReactElement => {
    const img = URL.createObjectURL(props.aortaSelectionProps.imgBlob);

    return (
        <div>
            <div className={styles.selectionWrapper}>
                <div className={styles.image}>
                    <img src={img} alt=""/>
                </div>
                <canvas className={styles.canvas} width="512" height="512"></canvas>
            </div>
            <div className={styles.buttonPanel}>
                <BaseButton onClick={() => {}}>Принять</BaseButton>
                <BaseButton onClick={() => {}}>Отклонить</BaseButton>
                <BaseButton onClick={() => {}}>Указать другой центр аорты</BaseButton>
            </div>
        </div>
    );
};
