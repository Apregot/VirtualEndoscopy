import React, { type ReactElement } from 'react';
import styles from './Popup.module.scss';

interface TProps {
    show: boolean
    children: ReactElement | string
    title: string
    onClose: () => void
}

export const Popup = (props: TProps): ReactElement => {
    return (
        <div  className={styles.background} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div>{props.title}</div>
                    <div className={styles.closeButton} onClick={props.onClose}>x</div>
                </div>
                <div className={styles.content}>
                    {props.children}
                </div>
            </div>
        </div>
    );
};
