import React, {ReactElement} from "react";
import {Popup} from "../../base/Popup";

interface TProps {
    onClose: () => void
}

export const VersionPopup = (props: TProps): ReactElement => {
    return (
        <Popup show={true} title={"Информация о версии"} onClose={() => {
            console.log('closing version popup');
            props.onClose();
        }}>
            <div style={{ paddingBottom: '15px' }}>
                <div style={{color: 'black'}}>
                    Текущая версия приложения: {__VERSION__}
                </div>
            </div>
        </Popup>
    );
}