import React, { type ReactElement, type ReactNode } from 'react';
import { ReactComponent as Arrow } from './arrow.svg';
interface TProps {
    children: ReactNode
}

export const SelectList = (props: TProps): ReactElement => {
    return (
        <div>
            <button className="px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors">{props.children}</button>
            <Arrow/>
            <ul>
                <li>1</li>
                <li>2</li>
            </ul>
        </div>
    );
};
