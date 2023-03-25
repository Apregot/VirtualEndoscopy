import { type Series } from '../../lib/Series';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SeriesState {
    series: Series[]
}

const initialState: SeriesState = {
    series: []
};

export const seriesSlice = createSlice({
    name: 'series',
    initialState,
    reducers: {
        pushSeries(state, action: PayloadAction<Series>) {
            state.series.push(action.payload);
        }
    }
});

export default seriesSlice.reducer;
