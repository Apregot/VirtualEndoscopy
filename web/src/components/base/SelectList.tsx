import React, { type ReactElement, type ReactNode } from 'react';
import styles from './SelectList.module.scss';
import { ReactComponent as Arrow } from './arrow.svg';
interface TProps {
    children: ReactNode
}

export const SelectList = (props: TProps): ReactElement => {
    return (
        <div>
            <button className={`px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors ${styles.button}`}>
                <span className="mr-1.5">{props.children}</span><Arrow className={styles.arrow}/>
            </button>
            <ul className={styles.list}>
                <li>1</li>
                <li>2</li>
            </ul>
        </div>
    );
};
