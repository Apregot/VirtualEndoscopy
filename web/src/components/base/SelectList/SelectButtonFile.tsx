import React, { type ReactElement, type ReactNode } from 'react';
import { Text } from '../../../lib';
import styles from './SelectButton.module.scss';

interface TProps {
    children: ReactNode
}

export const SelectButtonFile = (props: TProps): ReactElement => {
    const uuid = Text.generateUUID();
    return (
        <>
            <input id={uuid} className={styles.selectButtonFileInput} type="file"/>
            <label className={styles.selectButton} htmlFor={uuid}>{props.children}</label>
        </>
    );
};
