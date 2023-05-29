import React, {type ReactElement, useState} from 'react';
import { SelectButtonText, SelectList } from '../../base/SelectList';
import styles from './AboutMenu.module.scss';
import {HelpPopup} from "./HelpPopup";

export const AboutMenu = (): ReactElement => {
    const [isHelpPopupOpened, changePopupState] = useState(false);
    const onVersionClick = () => {
        changePopupState(true);
    }
    const onClosePopup = () => {
        changePopupState(false);
    }
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
                },
                {
                    id: 'menu_about_version',
                    content: (
                        <a target="_blank" className={styles.aboutLink} onClick={onVersionClick}>
                            <SelectButtonText>
                                Справка
                            </SelectButtonText>
                        </a>
                    )
                }
            ]}
        >
            О программе
            {isHelpPopupOpened ? <HelpPopup onClose={onClosePopup}></HelpPopup> : ''}
        </SelectList>
    );
};
