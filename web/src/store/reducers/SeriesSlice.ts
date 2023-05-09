import { type Series } from '../../lib/Series';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SeriesState {
    patientsSeriesList: Series[][]
    selectedPreviewSeries: Series | null
}

const initialState: SeriesState = {
    patientsSeriesList: [],
    selectedPreviewSeries: null
};

export const seriesSlice = createSlice({
    name: 'patientsSeriesList',
    initialState,
    reducers: {
        pushSeries: (state, action: PayloadAction<Series>) => {
            let check = true;

            for (const element of state.patientsSeriesList) {
                if (element.at(0)?.getId() === action.payload.getId()) {
                    check = false;
                    element.push(action.payload);
                }
            }
            check && state.patientsSeriesList.push([action.payload]);
        },

        selectPreviewSeries: (state, action: PayloadAction<Series>) => {
            state.selectedPreviewSeries = action.payload;
        },

        deleteSeries: (state, action: PayloadAction<Series>) => {
            for (const element of state.patientsSeriesList) {
                if (element.at(0)?.getId() === action.payload.getId()) {
                    const seriesIndex = element.findIndex(el => el.getUID() === action.payload.getUID());
                    element.splice(seriesIndex, 1);
                }
            }
        }
    }
});

export default seriesSlice.reducer;
