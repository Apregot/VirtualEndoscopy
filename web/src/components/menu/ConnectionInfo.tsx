import React, { useEffect, type ReactElement, useState } from 'react';
import { SocketService } from '../../lib/connection/SocketService';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { webSocketSlice } from '../../store/reducers/WebSocketSlice';

export enum ConnectionStatus {
    CONNECTED,
    DISCONNECTED,
    PROGRESS,
};

interface ServerResponse {
    Address: string
};

export const ConnectionInfo = (): ReactElement => {
    const [status, setStatus] = useState(ConnectionStatus.DISCONNECTED);

    const { connect } = webSocketSlice.actions;
    const dispatch = useAppDispatch();

    const { webSocket, isConnected } = useAppSelector((state) => state.webSocket);

    useEffect(() => {
        void fetch('http://158.160.65.29/atb/take', { // Фиксированный адрес сервака
            // mode: 'cors',
            method: 'GET'
        }).then(async (response: Response) => {
            return await response.json();
        }).then((result: ServerResponse) => {
            if (typeof result?.Address === 'string') {
                console.log('Socket Address: ', result.Address);
                dispatch(connect(new SocketService(`ws:${result.Address}`)));
            }
        });
    }, []);
    
    useEffect(() => {
        if (isConnected) {
            setStatus(ConnectionStatus.CONNECTED);
        } else {
            setStatus(ConnectionStatus.DISCONNECTED);
        }
    }, [webSocket]);
    
    const classes = 'ml-3 mt-1 max-h-6 px-2 py-1 rounded-lg font-semibold text-xs';
    
    return (
        <div>
            <div className={`${classes} ${getStatusClasses(status)}`}>• {getStatusTitle(status)}</div>            
        </div>
    );
};

function getStatusClasses(status: ConnectionStatus): string {
    switch (status) {
    case ConnectionStatus.CONNECTED:
        return 'text-green-600 bg-green-400/30';
    case ConnectionStatus.DISCONNECTED:
        return 'text-red-600 bg-red-400/30';
    case ConnectionStatus.PROGRESS:
        return 'text-yellow-600 bg-yellow-400/30';
    }
    return '';
}

function getStatusTitle(status: ConnectionStatus): string {
    switch (status) {
    case ConnectionStatus.CONNECTED:
        return 'Connected';
    case ConnectionStatus.DISCONNECTED:
        return 'Disconnected';
    case ConnectionStatus.PROGRESS:
        return 'Connection...';
    }
    return 'Undefined';
}
