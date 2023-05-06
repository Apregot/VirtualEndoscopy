import React, { type ReactElement } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../hooks/redux';
import { webSocketSlice, connect } from '../../../../store/reducers/WebSocketSlice';
import { BaseButton } from '../../.././base/Button';
import styles from './SeriesConnection.module.scss';
import { type RootState } from '../../../../store/ApplicationStore';
;

export const SeriesConnection = (): ReactElement => {
    const { webSocket } = useAppSelector((state: RootState) => state.webSocket);
    const { disconnect } = webSocketSlice.actions;
    const dispatch = useAppDispatch();

    return (
        <div className={styles.btnList}>
            <div className='flex'>
                <BaseButton onClick={() => { dispatch(connect()); }}>Connect</BaseButton>
                <BaseButton onClick={() => { dispatch(disconnect()); }}>Disconnect</BaseButton>
            </div>
            <div className='flex'>
                <BaseButton onClick={() => { console.log(webSocket); }}>Check Connection</BaseButton>
                <BaseButton onClick={() => { webSocket?.version(); }}>Check Version</BaseButton>
            </div>
        </div>
    );
};
