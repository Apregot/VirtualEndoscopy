import axios from 'axios';

class SocketService {
    private wsReady: boolean;
    private readonly ws: WebSocket;
    private readonly containerId: string;

    constructor(wsurl: string, id: string, onCLose: any) {
        this.wsReady = false;
        this.containerId = id;
        this.ws = new WebSocket(wsurl, 'ffr-protocol');
        this.ws.onopen = () => { console.log('connected'); this.wsReady = true; };
        this.ws.onclose = () => { console.log('disconnected'); this.wsReady = false; onCLose(); };
        this.ws.onerror = function() { console.log('error'); };
    }

    addEventListener(event: string, func: any): void {
        if (event === 'close') { this.ws.addEventListener('close', func); } else if (event === 'ready') { this.ws.addEventListener('open', func); }
    }

    isReady(): boolean { return this.wsReady; }

    disconnect(): void {
        this.ws.close();
    }

    getWebSocket(): WebSocket {
        return this.ws;
    }

    async prolongContainerLife(): Promise<void> {
        await axios.post('http://158.160.65.29/atb/prolong', {
            containerId: this.containerId
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    }
    
    async sendRequest(req: any): Promise<any> {
        // eslint-disable-next-line prefer-promise-reject-errors
        if (!this.wsReady) return await Promise.reject('no connection to server');
        return await new Promise((resolve, reject) => {
            this.ws.onmessage = (e) => { resolve(e.data); };
            this.ws.onerror = reject;
            console.log('sending on ffr-protocol: ', req);
            this.ws.binaryType = 'blob';
            this.ws.send(req);
        });
    }

    version(): void { this.sendRequest('version').then(value => { console.log('version: ', value); }).catch(error => { console.log('error: ', error); }); }
}
export { SocketService };
