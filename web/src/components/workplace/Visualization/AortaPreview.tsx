import React, { type ReactElement, useEffect, useRef } from 'react';
import { type AortaView, UP3 } from '../../../lib/visualization';
import { AortaConfig } from './AortaConfig';

interface TProps {
    aortaView: AortaView
}

export const AortaPreview = (props: TProps): ReactElement => {
    const previewRef = useRef(null);
    useEffect(() => {
        if (previewRef === null || previewRef.current === null) return;

        const previewFrame = previewRef.current;
        console.log(previewFrame);
        UP3.enable(previewFrame);
        UP3.initRenderer3D(previewFrame);
        // UP3.render(previewFrame);
    }, [previewRef]);
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <AortaConfig aorta={props.aortaView} onTauChange={(tau) => { console.log('changed', tau); }}/>
            <div style={{ width: '100%', height: '100%' }} ref={previewRef}></div>
        </div>
    );
};
