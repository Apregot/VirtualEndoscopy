import React, { type ReactElement } from 'react';
import styles from './BorderedBox.module.scss';
interface TProps {
    children: ReactElement
    title: string
}

export const BorderedBox = (props: TProps): ReactElement => {
    return (
        <div className={styles.wrapper}>
            <div className={styles.content}>
                <div className={styles.title}>{props.title}</div>
                <div>{props.children}</div>
            </div>
        </div>
    );
};
