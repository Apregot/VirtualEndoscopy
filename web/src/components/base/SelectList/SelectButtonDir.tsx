import React, { type ChangeEvent, type ReactElement, type ReactNode } from 'react';
import { Text } from '../../../lib';
import styles from './SelectButton.module.scss';

interface TProps {
    children: ReactNode
    onDirUpload: (files: FileList) => void
}

declare module 'react' {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        // extends React's HTMLAttributes
        directory?: string
        webkitdirectory?: string
    }
}

export const SelectButtonDir = (props: TProps): ReactElement => {
    const onChangeInputHandler = (event: ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files ?? new FileList();
        if (files != null) {
            props.onDirUpload(files);
        }
    };

    const uuid = Text.generateUUID();
    return (
        <>
            <input id={uuid} onChange={onChangeInputHandler} className={styles.selectButtonFileInput} type="file" 
                webkitdirectory="" />
            <label className={styles.selectButton} htmlFor={uuid}>{props.children}</label>
        </>
    );
};
