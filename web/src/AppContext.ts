import { type Series } from './lib/Series';
import React from 'react';

export interface TContext {
    series: Series[]
}

export const AppContext = React.createContext<TContext>({ series: [] });
