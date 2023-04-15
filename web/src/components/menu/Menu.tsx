import React, { type ReactElement, useState, useEffect } from 'react';
import styles from './Menu.module.scss';
import { ConnectionInfo } from './ConnectionInfo';
import { FileMenu } from './FilesMenu';
import { InputSwitch } from 'primereact/inputswitch';

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
                <ConnectionInfo/>
            </div>
            <div className={styles.themeSwitcher}>
                <span>Темная тема</span>
                <InputSwitch checked={darkTheme} onChange={(e) => { setDarkTheme(e.value); }}/>
            </div>
        </div>
    );
};
