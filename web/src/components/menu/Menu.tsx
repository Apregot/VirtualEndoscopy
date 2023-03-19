import { SelectList } from '../base/SelectList';
import React, { type ReactElement } from 'react';
import styles from './Menu.module.scss';

export const Menu = (): ReactElement => {
    return (
        <div className={styles.menu}>
            <SelectList>Файл</SelectList>
            <SelectList>Еще какой-нибудь пункт</SelectList>
        </div>
    );
};
