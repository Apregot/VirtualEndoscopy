import React, { type ReactElement } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../hooks/redux';
import { webSocketSlice, fetchURL, type FulfilledAction } from '../../../../store/reducers/WebSocketSlice';
import { BaseButton } from '../../../base/Button';
import styles from './ConnectionInfo.module.scss';
import { type RootState } from '../../../../store/ApplicationStore';
import { type SocketService } from '../../../../lib/connection/SocketService';
;

export const ConnectionInfo = (): ReactElement => {
    const { webSocket } = useAppSelector((state: RootState) => state.webSocket);
    const { disconnect, connect } = webSocketSlice.actions;
    const dispatch = useAppDispatch();

    return (
        <div className={styles.btnList}>
            <div className='flex'>
                <BaseButton onClick={() => { dispatch(fetchURL()).then((res: FulfilledAction<SocketService>) => {dispatch(connect(res.payload)); }).catch(() => {}); }}>Connect</BaseButton>
                <BaseButton onClick={() => { dispatch(disconnect()); }}>Disconnect</BaseButton>
            </div>
            <div className='flex'>
                <BaseButton onClick={() => { console.log(webSocket); }}>Check Connection</BaseButton>
                <BaseButton onClick={() => { webSocket?.version(); }}>Check Version</BaseButton>
            </div>
        </div>
    );
};
