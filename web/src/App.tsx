import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Menu } from './components/menu/Menu';
import React, { type ReactElement } from 'react';
import { AppContext } from './AppContext';

function App (): ReactElement {
    return (
        <div className="App">
            <AppContext.Provider value={{ series: [] }}>
                <Menu/>
                <Splitter style={{ height: '300px' }}>
                    <SplitterPanel className="flex align-items-center justify-content-center">Panel 1</SplitterPanel>
                    <SplitterPanel className="flex align-items-center justify-content-center">Panel 2</SplitterPanel>
                </Splitter>
            </AppContext.Provider>
        </div>
    );
}

export default App;
