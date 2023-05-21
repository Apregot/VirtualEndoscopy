import React, { useEffect, type ReactElement, useState } from 'react';
import { useAppSelector } from '../../hooks/redux';

export enum Status {
    CONNECTED,
    DISCONNECTED,
    PROGRESS,
};

export const ConnectionStatus = (): ReactElement => {
    const [connectionStatus, setConnectionStatus] = useState(Status.DISCONNECTED);

    const { status } = useAppSelector((state) => state.webSocket);
    
    useEffect(() => {
        switch (status) {
            case 'CONNECTED':
                setConnectionStatus(Status.CONNECTED);
                break;
            case 'DISCONNECTED':
                setConnectionStatus(Status.DISCONNECTED);
                break;
            case 'PROGRESS':
                setConnectionStatus(Status.PROGRESS);
                break;
            default:
                setConnectionStatus(Status.DISCONNECTED);   
        }
    }, [status]);
    
    const classes = 'ml-3 mt-1 max-h-6 px-2 py-1 rounded-lg font-semibold text-xs';
    
    return (
        <div>
            <div className={`${classes} ${getStatusClasses(connectionStatus)}`}>• {getStatusTitle(connectionStatus)}</div>            
        </div>
    );
};

function getStatusClasses(status: Status): string {
    switch (status) {
    case Status.CONNECTED:
        return 'text-green-600 bg-green-400/30';
    case Status.DISCONNECTED:
        return 'text-red-600 bg-red-400/30';
    case Status.PROGRESS:
        return 'text-yellow-600 bg-yellow-400/30';
    }
    return '';
}

function getStatusTitle(status: Status): string {
    switch (status) {
    case Status.CONNECTED:
        return 'Подключено';
    case Status.DISCONNECTED:
        return 'Нет соединения';
    case Status.PROGRESS:
        return 'Подключение к серверу...';
    }
    return 'Undefined';
}
