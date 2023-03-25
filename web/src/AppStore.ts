import { type Series } from './lib/Series';
import { type AnyAction, configureStore } from '@reduxjs/toolkit';

export interface TStoreData {
    series: Series[]
}

export const AppStore = configureStore<TStoreData>({
    reducer: (state: TStoreData | undefined, action: AnyAction) => {
        if (state === undefined) {
            state = {
                series: []
            };
        }

        switch (action.type) {
            case 'ADD_SERIES':
                state.series.push(action.payload); // Нужно использовать createSlice instead
                console.log('add_series', state.series);
                break;
        }

        return state;
    },
    middleware: (getDefaultMiddleware) => {
        return getDefaultMiddleware({
            serializableCheck: false
        });
    },
    devTools: true,
    preloadedState: {
        series: []
    }
});
