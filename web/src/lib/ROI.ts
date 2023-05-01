import { type Stack } from 'ami.js';
export class ROI {
    private readonly stack: Stack;
    constructor(stack: Stack) {
        this.stack = stack;
    }

    public getX(): number {
        return 0;
    }

    public getY(): number {
        return 0;
    }

    public getZ(): number {
        return 0;
    }

    public getXDistance(): number {
        return this.stack._rows;
    }

    public getYDistance(): number {
        return this.stack._columns;
    }

    public getZDistance(): number {
        return this.stack._numberOfFrames;
    }
}
