import React, { type ReactElement } from 'react';
import { SelectButtonFile, SelectList } from '../../base/SelectList';
import { DICOMLoader } from '../../../lib';

export const FileMenu = (): ReactElement => {
    const onFileUpload = (files: FileList): void => {
        DICOMLoader.loadSeries(files).then((a) => { console.log(a); }).catch((err) => { console.log(err); });
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
