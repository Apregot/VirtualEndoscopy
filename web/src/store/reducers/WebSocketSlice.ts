import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SocketService } from '../../lib/connection/SocketService';
 
interface ConnectionState {
    isConnected: boolean
    webSocket: SocketService | null
}

const initialState: ConnectionState = {
    isConnected: false,
    webSocket: null
};
 
export const webSocketSlice = createSlice({
    name: 'webSocket',
    initialState,
    reducers: {
        connect: (state, action: PayloadAction<SocketService>) => {
            state.webSocket = action.payload;
            state.isConnected = true;
        }
    }
});
 
export default webSocketSlice.reducer;
