import React, { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import styles from './SelectList.module.scss';
import { ReactComponent as Arrow } from './arrow.svg';
import { type ListItem, SelectPopupList } from './SelectPopupList';

interface TProps {
    children: ReactNode
    items: ListItem[]
    onItemSelect: (id: string) => void
}

export const SelectList = (props: TProps): ReactElement => {
    const [opened, setOpen] = useState<boolean>(false);
    const buttonStyles = opened
        ? 'px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors'
        : `px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors ${styles.buttonOpened}`;

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
        <div style={{ position: 'relative' }}>
            <button
                className={buttonStyles}
                onClick={() => { setOpen(!opened); }}
            >
                <span className="mr-1.5">{props.children}</span><Arrow className={styles.arrow}/>
            </button>
            <SelectPopupList opened={opened} items={props.items} onItemSelect={props.onItemSelect} />
        </div>
    );
};
