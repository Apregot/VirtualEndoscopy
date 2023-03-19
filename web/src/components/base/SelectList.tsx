import React, { type ReactElement, type ReactNode, useState } from 'react';
import styles from './SelectList.module.scss';
import { ReactComponent as Arrow } from './arrow.svg';
interface TProps {
    children: ReactNode
}

export const SelectList = (props: TProps): ReactElement => {
    const [opened, setOpen] = useState<boolean>(false);

    const buttonStyles = opened
        ? 'px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors'
        : `px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors ${styles.buttonOpened}`;

    const listDisplay = opened ? 'block' : 'none';

    return (
        <div>
            <button
                className={buttonStyles}
                onClick={() => { setOpen(!opened); }}
            >
                <span className="mr-1.5">{props.children}</span><Arrow className={styles.arrow}/>
            </button>
            <ul className={styles.list} style={{ display: listDisplay }}>
                <li>1</li>
                <li>2</li>
            </ul>
        </div>
    );
};
