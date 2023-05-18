export default class HTMLElementHelper {
    static getOffsetRect(element: HTMLElement): { top: number, left: number } {
        const box = element.getBoundingClientRect();
        const body = document.body;
        const docElem = document.documentElement;
        const scrollTop = (window.scrollY !== 0) || (docElem.scrollTop !== 0) || body.scrollTop;
        const scrollLeft = (window.scrollX !== 0) || (docElem.scrollLeft !== 0) || body.scrollLeft;
        const clientTop = (docElem.clientTop !== 0) || (body.clientTop !== 0) || 0;
        const clientLeft = (docElem.clientLeft !== 0) || (body.clientLeft !== 0) || 0;
        const top = box.top + Number(scrollTop) - Number(clientTop);
        const left = box.left + Number(scrollLeft) - Number(clientLeft);
        return { top: Math.round(top), left: Math.round(left) };
    }
}
