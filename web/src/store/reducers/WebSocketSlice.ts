import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { SocketService } from '../../lib/connection/SocketService';
import axios from 'axios';

interface Answer {
    url: string
    id: string
}

export const createWebSocket = createAsyncThunk(
    'webSocket/createWebSocket',
    async (arg, thunkAPI) => {
        const ans: Answer = await axios.get('http://158.160.65.29/atb/take')
            .then(res => {
                return {
                    url: res.data.Address,
                    id: res.data.Id
                };
            });
        return new SocketService(`ws:${ans.url}`, ans.id, () => { thunkAPI.dispatch(webSocketSlice.actions.disconnect()); });
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
            state.webSocket = null;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(createWebSocket.pending, (state) => {
            state.status = 'PROGRESS';
        });
        builder.addCase(createWebSocket.rejected, (state) => {
            state.status = 'DISCONNECTED';
        });
    }
});

export default webSocketSlice.reducer;
