import React, { type ReactElement } from 'react';

export enum ConnectionStatus {
    CONNECTED,
    DISCONNECTED,
    PROGRESS,
};

export const ConnectionInfo = (): ReactElement => {
    const status = ConnectionStatus.DISCONNECTED;
    const classes = 'ml-3 mt-1 max-h-6 px-2 py-1 rounded-lg font-semibold text-xs';
    
    return (
        <div className={`${classes} ${getStatusClasses(status)}`}>• {getStatusTitle(status)}</div>
    );
};

function getStatusClasses(status: ConnectionStatus): string {
    switch (status) {
        case ConnectionStatus.CONNECTED:
            return 'text-green-600 bg-green-100';
        case ConnectionStatus.DISCONNECTED:
            return 'text-red-600 bg-red-100';
        case ConnectionStatus.PROGRESS:
            return 'text-yellow-600 bg-yellow-100';
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