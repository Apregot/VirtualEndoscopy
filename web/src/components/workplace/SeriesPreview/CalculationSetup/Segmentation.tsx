import React, { type ReactElement } from 'react';
import { BaseButton } from '../../../base/Button';

export const Segmentation = (): ReactElement => {
    return (
        <div>
            <BaseButton disabled={true} onClick={() => { console.log('initializing ffr...'); }}>Initialize FFR processing</BaseButton>
        </div>
    );
};
