import { VolumeLoader } from 'ami.js';

/**
 * @todo Пока этот класс дублирует старый функционал. Нужно подумать над рефакторигом
 */
export default class FileVolumeLoader extends VolumeLoader {
    readonly #dataParser = null;
    constructor() {
        super();
        this.#dataParser = null;
    }

    /**
     * @todo Разузнать тип dataParser'a
     */
    get dataParser(): any {
        return this.#dataParser;
    }

    public async fetch(url: any): Promise<any> {
        return await new Promise(resolve => {
            const fileReader = new FileReader();

            fileReader.onload = () => {
                const buffer = fileReader.result;
                const response = {
                    url,
                    buffer
                };
                resolve(response);
            };

            fileReader.readAsArrayBuffer(url);
        });
    }

    public async load(url: File | FileList, requests = new Map<any, any>()): Promise<any> {
        console.log('[OLD APPLICATION] FileVolumeLoader::load()', url);
        const arrFiles = [];
        if (url instanceof File) {
            arrFiles.push(url);
        } else {
            for (let i = 0; i < url.length; i++) {
                arrFiles.push(url[i]);
            }
        }

        const loadSequences: Array<Promise<any> | Array<Promise<any>>> = [];
        arrFiles.forEach((file: File | File[]) => {
            if (!Array.isArray(file)) {
                loadSequences.push(
                    this.loadSequence(file, requests)
                );
            } else {
                loadSequences.push(
                    this.loadSequenceGroup(file, requests)
                );
            }
        });

        return await Promise.all(loadSequences);
    }
}
