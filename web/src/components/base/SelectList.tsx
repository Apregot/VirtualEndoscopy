import React, { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import styles from './SelectList.module.scss';
import { ReactComponent as Arrow } from './arrow.svg';
interface TProps {
    children: ReactNode
}

export const SelectList = (props: TProps): ReactElement => {
    const [opened, setOpen] = useState<boolean>(false);

    const buttonStyles = opened
        ? 'px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors'
        : `px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors ${styles.buttonOpened}`;

    const listDisplay = opened ? 'block' : 'none';

    useEffect(() => {
        if (opened) {
            setTimeout(() => {
                // HACK: При нажатии на другие кнопки нужно скрывать чужие меню. Для реализации оного в голову пришла только идея с таймером
                document.addEventListener('click', () => {
                    setOpen(false);
                }, { once: true });
            }, 0);
        }
    }, [opened]);

    return (
        <div>
            <button
                className={buttonStyles}
                onClick={() => { setOpen(!opened); }}
            >
                <span className="mr-1.5">{props.children}</span><Arrow className={styles.arrow}/>
            </button>
            <ul
                onClick={(e) => { e.stopPropagation(); }}
                className={styles.list} style={{ display: listDisplay }}
            >
                <li>1</li>
                <li>2</li>
            </ul>
        </div>
    );
};
