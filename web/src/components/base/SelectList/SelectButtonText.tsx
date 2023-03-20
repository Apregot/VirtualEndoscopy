import React, { type ReactElement, type ReactNode } from 'react';
import styles from './SelectButton.module.scss';

interface TProps {
    children: ReactNode
}

export const SelectButtonText = (props: TProps): ReactElement => {
    return (
        <span className={styles.selectButton}>{props.children}</span>
    );
};
