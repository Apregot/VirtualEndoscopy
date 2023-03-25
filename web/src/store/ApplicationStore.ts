import { combineReducers } from 'redux';
import { configureStore } from '@reduxjs/toolkit';
import seriesReducer from './reducers/SeriesSlice';

const rootReducer = combineReducers({
    seriesReducer
});

export const setupStore = () => {
    return configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) => {
            return getDefaultMiddleware({
                serializableCheck: false
            });
        }
    });
};

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore['dispatch'];
