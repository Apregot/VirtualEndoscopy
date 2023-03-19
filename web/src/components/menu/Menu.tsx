import { SelectList } from '../base/SelectList';
import React, { type ReactElement } from 'react';
import styles from './Menu.module.scss';

export const Menu = (): ReactElement => {
    return (
        <div className={styles.menu}>
            <SelectList items={[{ id: 'one', title: 'Загрузить' }, { id: 'two', title: 'Еще чето' }]} onItemSelect={(id) => { console.log(`ITEM SELECTED: ${id}`); }}>Файл</SelectList>
            <SelectList items={[{ id: 'one', title: 'Загрузить' }, { id: 'two', title: 'Еще чето' }]} onItemSelect={(id) => { console.log(`ITEM SELECTED: ${id}`); }}>Еще какой-нибудь пункт</SelectList>
        </div>
    );
};
