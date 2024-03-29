import React, { type ReactElement, useState, useEffect } from 'react';
import styles from './Menu.module.scss';
import { ConnectionStatus } from './ConnectionStatus';
import { FileMenu } from './FilesMenu';
import { AboutMenu } from './AboutMenu';
import { InputSwitch, type InputSwitchChangeEvent } from 'primereact/inputswitch';

interface TProps {
    onDarkThemeChanged?: (darkTheme: boolean) => void
}

export const Menu = (props: TProps): ReactElement => {
    const [darkTheme, setDarkTheme] = useState(true);

    useEffect(() => {
        if (props.onDarkThemeChanged != null) {
            props.onDarkThemeChanged(darkTheme);
        }
    }, [darkTheme]);

    return (
        <div className={styles.menu}>
            <div>
                <FileMenu/>
                <AboutMenu/>
                <ConnectionStatus/>
            </div>
            <div className={styles.themeSwitcher}>
                <span>Темная тема</span>
                <InputSwitch checked={darkTheme} onChange={(e: InputSwitchChangeEvent) => { setDarkTheme(e.value as boolean); }}/>
            </div>
        </div>
    );
};
