import React, { type ReactElement } from 'react';
import { SelectButtonFile, SelectList } from '../../base/SelectList';
import { DICOMLoader } from '../../../lib';
import { useAppDispatch } from '../../../hooks/redux';
import { seriesSlice } from '../../../store/reducers/SeriesSlice';
import { Series } from '../../../lib/Series';

export const FileMenu = (): ReactElement => {
    const { pushSeries } = seriesSlice.actions;
    const dispatch = useAppDispatch();

    const onFileUpload = (files: FileList): void => {
        DICOMLoader.loadSeries(files).then((model) => {
            dispatch(pushSeries(new Series(model)));
        }).catch((err) => { console.error(err); });
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
