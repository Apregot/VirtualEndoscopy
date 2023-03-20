import React, { type ReactElement } from 'react';
import { SelectButtonFile, SelectList } from '../../base/SelectList';

export const FileMenu = (): ReactElement => {
    const onFileUpload = (file: File): void => {
        console.log('FILE UPLOADED: ', file);
    };

    return (
        <SelectList
            items={[
                { id: 'menu_file_upload', content: <SelectButtonFile onFileUpload={onFileUpload}>Чтение DICOM файла</SelectButtonFile> }
            ]}
        >
            Файл
        </SelectList>
    );
};
