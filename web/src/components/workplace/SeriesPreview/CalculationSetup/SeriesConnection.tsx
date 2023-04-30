import React, { type ReactElement } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../hooks/redux';
import { webSocketSlice } from '../../../../store/reducers/WebSocketSlice';
import { BaseButton } from '../../.././base/Button';
import styles from './SeriesConnection.module.scss';

export const SeriesConnection = (): ReactElement => {
    const { webSocket } = useAppSelector((state) => state.webSocket);
    const { disconnect } = webSocketSlice.actions;
    const dispatch = useAppDispatch();

    return (
        <div className={styles.btnList}>
            <BaseButton onClick={() => { console.log(webSocket); }}>Check Connection</BaseButton>
            <BaseButton onClick={() => { dispatch(disconnect()); }}>Disconnect</BaseButton>
            <BaseButton onClick={() => { webSocket?.version(); }}>Check Connection</BaseButton>
        </div>
    );
};
