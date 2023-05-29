import React, {ReactElement} from "react";
import {Popup} from "../../base/Popup";

interface TProps {
    onClose: () => void
}

export const HelpPopup = (props: TProps): ReactElement => {
    return (
        <Popup show={true} title={"Виртуальная эндоскопия"} onClose={() => {
            console.log('closing help popup');
            props.onClose();
        }}>
            <div style={{ paddingBottom: '15px', display: 'flex', flexDirection: 'column'}}>
                <div style={{ color: 'black' }}>
                    Версия приложения: {__VERSION__}
                </div>
            </div>
        </Popup>
    );
}