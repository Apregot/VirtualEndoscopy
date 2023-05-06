import React, { useEffect, type ReactElement, useState } from 'react';
import { useAppSelector } from '../../hooks/redux';

export enum ConnectionStatus {
    CONNECTED,
    DISCONNECTED,
    PROGRESS,
};

export const ConnectionInfo = (): ReactElement => {
    const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.DISCONNECTED);

    const { status } = useAppSelector((state) => state.webSocket);
    
    useEffect(() => {
        switch (status) {
            case 'CONNECTED':
                setConnectionStatus(ConnectionStatus.CONNECTED);
                break;
            case 'DISCONNECTED':
                setConnectionStatus(ConnectionStatus.DISCONNECTED);
                break;
            case 'PROGRESS':
                setConnectionStatus(ConnectionStatus.PROGRESS);
                break;
            default:
                setConnectionStatus(ConnectionStatus.DISCONNECTED);   
        }
    }, [status]);
    
    const classes = 'ml-3 mt-1 max-h-6 px-2 py-1 rounded-lg font-semibold text-xs';
    
    return (
        <div>
            <div className={`${classes} ${getStatusClasses(connectionStatus)}`}>• {getStatusTitle(connectionStatus)}</div>            
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
        return 'Connecting...';
    }
    return 'Undefined';
}
