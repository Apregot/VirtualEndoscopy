import React, { type ReactElement } from 'react';
import styles from './SelectPopupList.module.scss';

export interface ListItem {
    id: string | number
    content: ReactElement
}

interface TProps {
    items: ListItem[]
    onItemSelect: (id: string | number) => void
    opened: boolean
    className?: string
}

export const SelectPopupList = (props: TProps): ReactElement => {
    const opened = props.opened;
    const listDisplay = opened ? 'block' : 'none';

    const onListItemSelected = (id: string | number): void => {
        props.onItemSelect(id);
    };

    const classes = `${styles.list} ${props?.className ?? ''}`;

    return (
        <ul
            className={classes} style={{ display: listDisplay }}
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
