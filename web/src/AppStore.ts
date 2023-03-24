import { type Series } from './lib/Series';
import { configureStore } from '@reduxjs/toolkit';

export interface TContext {
    series: Series[]
}

export const AppStore = configureStore({
    reducer: (store, action) => { console.log(store, action); },
    devTools: true
});
