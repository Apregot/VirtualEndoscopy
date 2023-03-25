import React, { type ReactElement } from 'react';
import { SelectButtonFile, SelectList } from '../../base/SelectList';
import { DICOMLoader } from '../../../lib';
import { useDispatch } from 'react-redux';

export const FileMenu = (): ReactElement => {
    const dispatch = useDispatch();

    const onFileUpload = (files: FileList): void => {
        DICOMLoader.loadSeries(files).then((model) => { dispatch({ type: 'ADD_SERIES', payload: model }); }).catch((err) => { console.log(err); });
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
