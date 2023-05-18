export default class Text {
    static generateUUID(): string {
        // TEMP: решаем проблему с HTTPS протоколом и crypto.generateUUID. Эта строка не является UUID, да и впринципе она бесполезна в таком формате.
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        const length = 15;
        while (counter < length) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
            counter += 1;
        }
        return result;
    }
}
