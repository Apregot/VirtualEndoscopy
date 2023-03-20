import React, { type ReactElement } from 'react';
import { SelectButtonFile, SelectList } from '../../base/SelectList';

export const FileMenu = (): ReactElement => {
    return (
        <SelectList
            items={[
                { id: 'one', content: <SelectButtonFile>Чтение DICOM файла</SelectButtonFile> }
            ]}
            onItemSelect={(id) => { console.log(`ITEM SELECTED: ${id}`); }}>Файл</SelectList>
    );
};
