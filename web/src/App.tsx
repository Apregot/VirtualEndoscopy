import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import { Menu } from './components/menu/Menu';
import React, { type ReactElement } from 'react';
import { Provider } from 'react-redux';
import { setupStore } from './store/ApplicationStore';
import { WorkArea } from './components/workplace/WorkArea';

const appStore = setupStore();

function App (): ReactElement {
    return (
        <div className="App">
            <Provider store={appStore}>
                <Menu/>
                <WorkArea/>
            </Provider>
        </div>
    );
}

export default App;
