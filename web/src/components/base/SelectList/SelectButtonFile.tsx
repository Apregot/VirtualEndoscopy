import React, { type ChangeEvent, type ReactElement, type ReactNode } from 'react';
import { Text } from '../../../lib';
import styles from './SelectButton.module.scss';

interface TProps {
    children: ReactNode
    onFileUpload: (files: FileList) => void
}

export const SelectButtonFile = (props: TProps): ReactElement => {
    const onChangeInputHandler = (event: ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files ?? new FileList();
        if (files != null) {
            props.onFileUpload(files);
        }
    };

    const uuid = Text.generateUUID();
    return (
        <>
            <input id={uuid} onChange={onChangeInputHandler} className={styles.selectButtonFileInput} type="file"/>
            <label className={styles.selectButton} htmlFor={uuid}>{props.children}</label>
        </>
    );
};
