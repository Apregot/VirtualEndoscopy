import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { SocketService } from '../../lib/connection/SocketService';
import axios from 'axios';

export const fetchURL = createAsyncThunk(
    'webSocket/fetchURL',
    async (thunkAPI) => {
        const url: string = await axios.get('http://158.160.65.29/atb/take')
            .then(res => {
                return res.data.Address;
            });
        
        return new SocketService(`ws:${url}`);
    }
);
interface ConnectionState {
    status: 'CONNECTED' | 'DISCONNECTED' | 'PROGRESS'
    webSocket: SocketService | null
}

const initialState: ConnectionState = {
    status: 'DISCONNECTED',
    webSocket: null
};

export const webSocketSlice = createSlice({
    name: 'webSocket',
    initialState,
    reducers: {
        connect: (state, action) => {
            state.webSocket = action.payload;
            state.status = 'CONNECTED';
        },
        disconnect: (state) => {
            state.status = 'DISCONNECTED';
            state.webSocket?.disconnect();
            state.webSocket = null;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(fetchURL.pending, (state) => {
            state.status = 'PROGRESS';
        });
        builder.addCase(fetchURL.rejected, (state) => {
            state.status = 'DISCONNECTED';
        });
    }
});

export default webSocketSlice.reducer;
