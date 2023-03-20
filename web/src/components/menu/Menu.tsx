import React, { type ReactElement } from 'react';
import styles from './Menu.module.scss';
import { ConnectionInfo } from './ConnectionInfo';
import { FileMenu } from './FilesMenu';

export const Menu = (): ReactElement => {
    return (
        <div className={styles.menu}>
            <FileMenu/>
            <ConnectionInfo/>
        </div>
    );
};
