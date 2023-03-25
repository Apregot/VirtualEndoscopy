import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Menu } from './components/menu/Menu';
import React, { type ReactElement } from 'react';
import { Provider } from 'react-redux';
import { setupStore } from './store/ApplicationStore';

const appStore = setupStore();

function App (): ReactElement {
    return (
        <div className="App">
            <Provider store={appStore}>
                <Menu/>
                <Splitter style={{ height: '300px' }}>
                    <SplitterPanel className="flex align-items-center justify-content-center">Panel 1</SplitterPanel>
                    <SplitterPanel className="flex align-items-center justify-content-center">Panel 2</SplitterPanel>
                </Splitter>
            </Provider>
        </div>
    );
}

export default App;
