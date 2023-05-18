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
        },
        thinOutSeries: (state, action: PayloadAction<{ series: Series, limit: number }>) => {
            const series = action.payload.series;      
            const numberOfFrames = series.getNF();

            if (numberOfFrames <= action.payload.limit) { console.log('прореживание не требуется'); } else {
                let N = 2;
                while (numberOfFrames / N > action.payload.limit) { N *= 2; }
                for (let i = 0; i < series.getModel().stack.at(0).frame.length; i++) { series.getModel().stack.at(0)?.frame.splice(i + 1, N - 1); }
            
                series.setNF(series.getModel().stack.at(0)?.frame.length);
                series.getModel().stack[0]._numberOfFrames = series.getModel().stack.at(0).frame.length;
                series.getModel().stack[0].dimensionsIJK.z = series.getModel().stack.at(0).frame.length;
                series.getModel().stack[0]._halfDimensionsIJK.z = series.getModel().stack.at(0).frame.length / 2;
                series.getROI().max.z = series.getModel().stack.at(0).frame.length;
            
                for (const element of state.patientsSeriesList) {
                    if (element.at(0)?.getId() === action.payload.series.getId()) {
                        const seriesIndex = element.findIndex(el => el.getUID() === action.payload.series.getUID());
                        element.splice(seriesIndex, 1);
                        element.push(series);
                    }
                }
            }
        }
    }
});

export default seriesSlice.reducer;
