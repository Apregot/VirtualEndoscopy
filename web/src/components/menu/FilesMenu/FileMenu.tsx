import React, { type ReactElement } from 'react';
import { SelectButtonFile, SelectList } from '../../base/SelectList';
import { DICOMLoader } from '../../../lib';
import { useAppDispatch } from '../../../hooks/redux';
import { seriesSlice } from '../../../store/reducers/SeriesSlice';
import { Series } from '../../../lib/Series';
import { SelectButtonDir } from '../../base/SelectList/SelectButtonDir';

export const FileMenu = (): ReactElement => {
    const { pushSeries } = seriesSlice.actions;
    const dispatch = useAppDispatch();

    const onFileUpload = (files: FileList): void => {
        DICOMLoader.loadSeries(files)
            .then((model) => {
                dispatch(pushSeries(new Series(model)));
            })
            .catch((err) => {
                console.error(err);
            });
    };
    const onDirUpload = (files: FileList): void => {
        DICOMLoader.loadSeries(files)
            .then((model) => {
                const series = new Series(model);
                series.getStack()._numberOfFrames = series.getStack().frame.length;
                series.setNF(series.getStack().frame.length);
                dispatch(pushSeries(series));
            })
            .catch((err) => {
                console.error(err);
            });
    };

    return (
        <SelectList
            onItemSelect={(id) => { console.log(`[FILE MENU] Item '${id}' selected`); }}
            items={[
                {
                    id: 'menu_file_upload',
                    content: (
                        <SelectButtonFile onFileUpload={onFileUpload}>
              Чтение DICOM файла
                        </SelectButtonFile>
                    )
                },
                {
                    id: 'menu_dir_upload',
                    content: (
                        <SelectButtonDir onDirUpload={onDirUpload}>
              Чтение DICOM каталога
                        </SelectButtonDir>
                    )
                }
            ]}
        >
      Файл
        </SelectList>
    );
};
