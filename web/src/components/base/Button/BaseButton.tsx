import React, { type ReactElement } from 'react';
import styles from './BaseButton.module.scss';

interface TProps {
    children: ReactElement | string
    onClick: () => void
    disabled?: boolean
}

export const BaseButton = (props: TProps): ReactElement => {
    let disabled = false;
    if (props?.disabled === true) {
        disabled = true;
    }
    return (
        <button disabled={disabled} className={styles.btn} onClick={props.onClick}>{props.children}</button>
    );
};
