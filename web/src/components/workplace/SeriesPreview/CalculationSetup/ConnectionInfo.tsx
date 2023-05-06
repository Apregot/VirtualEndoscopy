import React, { type ReactElement } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../hooks/redux';
import { webSocketSlice, fetchURL } from '../../../../store/reducers/WebSocketSlice';
import { BaseButton } from '../../../base/Button';
import styles from './ConnectionInfo.module.scss';
import { type RootState } from '../../../../store/ApplicationStore';
import { type SocketService } from '../../../../lib/connection/SocketService';
;

export const ConnectionInfo = (): ReactElement => {
    const { webSocket, status } = useAppSelector((state: RootState) => state.webSocket);
    const { disconnect, connect } = webSocketSlice.actions;
    const dispatch = useAppDispatch();

    return (
        <div className={styles.btnList}>
            <div className='flex'>
                { (status === 'DISCONNECTED') ? <BaseButton onClick={() => { dispatch(fetchURL()).unwrap().then((originalPromiseResult: SocketService) => { dispatch(connect(originalPromiseResult)); }).catch((rejectedValue) => { console.log(rejectedValue.message); }); }}>Connect</BaseButton> : <BaseButton disabled onClick={() => { dispatch(fetchURL()).unwrap().then((originalPromiseResult: SocketService) => { dispatch(connect(originalPromiseResult)); }).catch((rejectedValue) => { console.log(rejectedValue.message); }); }}>Connect</BaseButton> }
                { (status === 'CONNECTED') ? <BaseButton onClick={() => { dispatch(disconnect()); }}>Disconnect</BaseButton> : <BaseButton disabled onClick={() => { dispatch(disconnect()); }}>Disconnect</BaseButton> }
            </div>
            <div className='flex'>
                {(status === 'CONNECTED') ? <BaseButton onClick={() => { webSocket?.version(); }}>Check Version</BaseButton> : <BaseButton disabled onClick={() => { webSocket?.version(); }}>Check Version</BaseButton> }
            </div>
        </div>
    );
};
