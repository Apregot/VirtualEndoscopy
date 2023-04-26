class SocketService {
    _wsurl: string;
    _wsready: boolean;
    _ws: WebSocket;

    constructor(wsurl: string) {
        this._wsurl = wsurl;
        this._wsready = false;
        this._ws = new WebSocket(wsurl, 'ffr-protocol');
        this._ws.onopen = function() { alert('CONNECTED'); };
        this._ws.onclose = function() { alert('DISCONNECTED'); };
        this._ws.onerror = function() { alert('ERROR'); };
    }
  
// async sendRequest(req: any): Promise<string> {
//     if (!this._wsready) return await Promise.reject('no connection to server');
//     const self = this;
//     return await new Promise(function (resolve, reject) {
//         self._ws.onmessage = (e) => { resolve(e.data); };
//         self._ws.onerror = reject;
//         console.log('sending on ffr-protocol: ', req);
//         // WebSocket.binaryType = "blob" (default) | "arraybuffer"
//         self._ws.binaryType = 'blob';
//         self._ws.send(req);
//     });	
// }
}
export { SocketService };
