import React, { type ReactElement } from 'react';
import { SelectButtonText, SelectList } from '../../base/SelectList';
import styles from './AboutMenu.module.scss';

export const AboutMenu = (): ReactElement => {
    return (
        <SelectList
            onItemSelect={(id) => { console.log(`[FILE MENU] Item '${id}' selected`); }}
            items={[
                {
                    id: 'menu_about_repo',
                    content: (
                        <a target="_blank" className={styles.aboutLink} href="https://github.com/Apregot/VirtualEndoscopy" rel="noreferrer">
                            <SelectButtonText>
                                Репозиторий
                            </SelectButtonText>
                        </a>
                    )
                }
            ]}
        >
            О программе
        </SelectList>
    );
};
