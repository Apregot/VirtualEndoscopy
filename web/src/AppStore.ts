import { type Series } from './lib/Series';
import { type AnyAction, configureStore } from '@reduxjs/toolkit';

export interface TStoreData {
    series: Series[]
}

export const AppStore = configureStore<TStoreData>({
    reducer: (state: TStoreData | undefined, action: AnyAction) => {
        console.log(state, action);

        if (state === undefined) {
            state = {
                series: []
            };
        }

        return state;
    },
    devTools: true,
    preloadedState: {
        series: []
    }
});
