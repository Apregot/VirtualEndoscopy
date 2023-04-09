import React, { type ReactElement, useEffect, useState } from 'react';
import styles from './SelectPopupList.module.scss';

export interface ListItem {
    id: string
    content: ReactElement
}

interface TProps {
    items: ListItem[]
    onItemSelect: (id: string) => void
    opened?: boolean
}

export const SelectPopupList = (props: TProps): ReactElement => {
    const opened = props?.opened ?? false;
    const listDisplay = opened ? 'block' : 'none';

    const onListItemSelected = (id: string): void => {
        props.onItemSelect(id);
    };

    return (
        <ul
            className={styles.list} style={{ display: listDisplay }}
        >
            {
                props.items.map((listItem: ListItem) => {
                    return (
                        <li key={listItem.id} onClick={() => { onListItemSelected(listItem.id); }}>{listItem.content}</li>
                    );
                })
            }
        </ul>
    );
};
