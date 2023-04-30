import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.scss';

import { Menu } from './components/menu/Menu';
import React, { type ReactElement, useState } from 'react';
import { Provider } from 'react-redux';
import { setupStore } from './store/ApplicationStore';
import { WorkArea } from './components/workplace/WorkArea';
import { createGlobalStyle } from 'styled-components';

const appStore = setupStore();

interface GlobalStyleProperties {
    isDarkMode: boolean
}

function App (): ReactElement {
    const [darkTheme, setDarkTheme] = useState(true);

    let GlobalStyle;
    if (darkTheme) {
        GlobalStyle = createGlobalStyle<GlobalStyleProperties>`
          :root {
            --app-theme-bg: rgb(10 10 10);
            --app-theme-bg-second: rgb(23 23 23);
            --app-theme-bg-third: rgb(38 38 38);
            --app-theme-primary: rgb(245 245 244);
            --app-theme-secondary: #cecece;
            --app-theme-third: #808080;

            --shadow-color: rgb(216 227 234 / 27%);
          }
        `;
    } else {
        GlobalStyle = createGlobalStyle<GlobalStyleProperties>`
          :root {
            --app-theme-bg: #ffffff;
            --app-theme-bg-second: rgb(250 250 250);
            --app-theme-bg-third: #e5e7eb;
            --app-theme-primary: #495057;
            --app-theme-secondary: #a1a1aa;
            --app-theme-third: #c0bebe;

            --shadow-color: rgba(34, 60, 80, 0.1);
          }
        `;
    }

    return (
        <div className="App">
            <Provider store={appStore}>
                <Menu onDarkThemeChanged={(isDarkTheme: boolean) => { setDarkTheme(isDarkTheme); }}/>
                <WorkArea/>
            </Provider>
            <GlobalStyle isDarkMode={darkTheme}/>
        </div>
    );
}

export default App;
