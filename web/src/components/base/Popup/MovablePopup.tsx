import React, { type CSSProperties, type ReactElement, useEffect, useState, type MouseEvent } from 'react';
import commonStyles from './Popup.module.scss';
import styles from './MovablePopup.module.scss';

interface TProps {
    children: ReactElement | string
    title: string
    onClose: () => void
    style?: CSSProperties
}

interface Position {
    y: number
    x: number
};
export const MovablePopup = (props: TProps): ReactElement => {
    const [position, setPosition] = useState<Position>({
        y: window.innerHeight / 2.5,
        x: window.innerWidth / 2.5
    });

    const [isActive, setActive] = useState<boolean>(false);
    const [prevPos, setPrevPos] = useState<Position>({
        x: 0,
        y: 0
    });

    const moveAt = (dx: number, dy: number): void => {
        const newX = position.x + dx;
        const newY = position.y + dy;
        setPosition({ x: newX, y: newY });
    };

    const mouseDown = (event: MouseEvent<HTMLElement>): void => {
        setActive(true);
        setPrevPos(
            {
                x: event.pageX,
                y: event.pageY
            }
        );
    };

    const mouseMove = (event: MouseEvent<HTMLElement>): void => {
        if (!isActive) {
            return;
        }

        moveAt(event.pageX - prevPos.x, event.pageY - prevPos.y);
        setPrevPos({ x: event.pageX, y: event.pageY });
    };

    const mouseUp = (event: MouseEvent<HTMLElement>): void => {
        setActive(false);
    };

    return (
        <div style={{ ...(props.style ?? {}), ...{ left: `${position.x}px`, top: `${position.y}px` } }} className={styles.modal}
        >
            <div
                className={`${commonStyles.header} ${styles.header}`}
                style={{
                    cursor: isActive ? 'grabbing' : 'grab'
                }}
                onMouseDown={mouseDown}
                onMouseMove={mouseMove}
                onMouseUp={mouseUp}
            >
                <div className={commonStyles.headerTitle}>{props.title}</div>
                <div className={commonStyles.closeButton} onClick={props.onClose}>x</div>
            </div>
            <div className={commonStyles.content}>
                {props.children}
            </div>
        </div>
    );
};
