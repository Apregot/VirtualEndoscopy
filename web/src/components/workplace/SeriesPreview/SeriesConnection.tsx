import React, { type ReactElement } from 'react';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { webSocketSlice } from '../../../store/reducers/WebSocketSlice';

export const SeriesConnection = (): ReactElement => {
    const { webSocket } = useAppSelector((state) => state.webSocket);
    const { disconnect } = webSocketSlice.actions;
    const dispatch = useAppDispatch();

    return (
        <div>
            <button className={'ml-3'} onClick={() => { console.log(webSocket); }}>Check Connection</button>
            <button className={'ml-3'} onClick={() => { dispatch(disconnect()); }}>Disconnect</button>
            <button className={'ml-3'} onClick={() => { webSocket?.version(); }}>Check version</button>
        </div>
    );
};
