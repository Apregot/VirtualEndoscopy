import { type Series } from '../../lib/Series';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SeriesState {
    patientsSeriesList: Series[][]
}

const initialState: SeriesState = {
    patientsSeriesList: []
};

export const seriesSlice = createSlice({
    name: 'patientsSeriesList',
    initialState,
    reducers: {
        pushSeries: (state, action: PayloadAction<Series>) => {
            let check = true;

            for (const element of state.patientsSeriesList) {
                if (element.at(0)?.getId === action.payload.getId) {
                    check = false;
                    element.push(action.payload);
                }
            }
            check && state.patientsSeriesList.push([action.payload]);
        }
    }
});

export default seriesSlice.reducer;
