import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Menu } from './components/menu/Menu';
import React from 'react';

function App (): JSX.Element {
    return (
        <div className="App">
            <Menu/>
            <Splitter style={{ height: '300px' }}>
                <SplitterPanel className="flex align-items-center justify-content-center">Panel 1</SplitterPanel>
                <SplitterPanel className="flex align-items-center justify-content-center">Panel 2</SplitterPanel>
            </Splitter>
        </div>
    );
}

export default App;
